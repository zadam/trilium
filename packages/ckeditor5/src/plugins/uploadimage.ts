import {
	FileRepository,
	Plugin,
	type Editor,
	type FileLoader,
	type LocaleTranslate,
	type UploadAdapter
} from "ckeditor5";

export default class UploadimagePlugin extends Plugin {
	static get requires() {
		return [ FileRepository ];
	}

	static get pluginName() {
		return 'UploadimagePlugin';
	}

	init() {
		const editor = this.editor;
		const fileRepository = editor.plugins.get('FileRepository');
		fileRepository.createUploadAdapter = loader => new Adapter(loader, editor);
	}
}

const linkLoaders = new WeakSet<FileLoader>();

/** Makes the upload answer with a link to the attachment, and store a picture as uploaded. */
export function uploadAsLink(loader: FileLoader) {
	linkLoaders.add(loader);
}

export function isUploadAsLink(loader: FileLoader) {
	return linkLoaders.has(loader);
}

class Adapter implements UploadAdapter {
    private loader: FileLoader;
    private editor: Editor;
    private t: LocaleTranslate;
    private xhr?: XMLHttpRequest;
    private rejectLocal?: () => void;

	/**
	 * Creates a new adapter instance.
	 */
	constructor(loader: FileLoader, editor: Editor) {
		/**
		 * FileLoader instance to use during the upload.
		 */
		this.loader = loader;
		this.editor = editor;
		this.t = editor.t;
	}

	/**
	 * Starts the upload process.
	 *
	 * @see module:upload/filerepository~Adapter#upload
	 */
	upload() {
		const localUpload = glob.getLocalUpload?.();
		if (localUpload) {
			return this._uploadLocally(localUpload) as Promise<any>;
		}

		return this.loader.file
			.then( file => new Promise<File | null>( ( resolve, reject ) => {
				this._initRequest().then(() => {
					this._initListeners(resolve, reject);
					this._sendRequest();
				});
			} ) ) as Promise<any>;
	}

	/**
	 * Aborts the upload process.
	 *
	 * @see module:upload/filerepository~Adapter#abort
	 * @returns {Promise}
	 */
	abort() {
		if (this.xhr) {
			this.xhr.abort();
		}
		this.rejectLocal?.();
	}

	/**
	 * Hands the file to the host's local server. A raw request with a body cannot reach it: the
	 * mobile app's native request bridges answer GET and HEAD only.
	 */
	private async _uploadLocally(localUpload: LocalUpload) {
		const file = await this.loader.file;
		if (!file) {
			throw "Missing file";
		}

		const genericError = this.t('Cannot upload file:') + ` ${file.name}.`;
		const { url, headers } = await this._getRequestTarget();
		const aborted = new Promise<never>((_, reject) => {
			this.rejectLocal = () => reject();
		});

		const upload = (async () => {
			let resp: Response;
			try {
				resp = await localUpload(url, { method: 'POST', headers, fields: {}, file });
			} catch {
				throw genericError;
			}

			const response = await resp.json().catch(() => null);
			if (!response?.uploaded) {
				throw `${genericError} ${describeUploadFailure(this.t, resp.status, response)}`.trim();
			}
			return { default: response.url };
		})();

		try {
			return await Promise.race([ upload, aborted ]);
		} finally {
			this.rejectLocal = undefined;
		}
	}

	/**
	 * Initializes the XMLHttpRequest object.
	 *
	 * @private
	 */
	_initRequest() {
		return this._getRequestTarget().then(({ url, headers }) => {
			const xhr = this.xhr = new XMLHttpRequest();

			xhr.open('POST', url, true);
			xhr.responseType = 'json';

			for (const headerName in headers) {
				xhr.setRequestHeader(headerName, headers[headerName]);
			}
		});
	}

	/** The relative URL of the upload route for the editor's note, and the request headers. */
	private async _getRequestTarget() {
		const domRoot = this.editor.editing.view.getDomRoot();
		const component = glob.getComponentByEl<EditorComponent>( domRoot );

		// Sent as a change of the host, which then does not redraw the links and embeds it shows.
		const headers = await glob.getHeaders({ "trilium-component-id": component?.componentId });

		// The note the editor holds, which is not the active tab's in a split or the quick edit
		// popup. A host that does not say falls back to the active tab's.
		const noteId = component?.getNoteId?.() ?? glob.getActiveContextNote().noteId;
		const query = isUploadAsLink(this.loader) ? "?link=true" : "";

		// this must be a relative path
		return { url: `api/notes/${noteId}/attachments/upload${query}`, headers };
	}

	/**
	 * Initializes XMLHttpRequest listeners.
	 *
	 * @private
	 * @param resolve Callback function to be called when the request is successful.
	 * @param reject Callback function to be called when the request cannot be completed.
	 */
	async _initListeners(resolve: (value: File | PromiseLike<File | null> | null) => void, reject: (reason?: any) => void) {
		const xhr = this.xhr;
        /* v8 ignore next 4 -- unreachable: _initListeners runs only after _initRequest() resolves, which always assigns this.xhr */
        if (!xhr) {
            reject("Missing XHR");
            return;
        }

		const loader = this.loader;
		const file = await loader.file;
        if (!file) {
            reject("Missing file");
            return;
        }

		const t = this.t;
		const genericError = t('Cannot upload file:') + ` ${file.name}.`;

		xhr.addEventListener('error', () => reject(genericError));
		xhr.addEventListener('abort', () => reject());
		xhr.addEventListener('load', () => {
			const response = xhr.response;

			if (!response || !response.uploaded) {
				return reject(`${genericError} ${describeUploadFailure(t, xhr.status, response)}`.trim());
			}

			resolve({
				default: response.url
			} as unknown as File);
		});

		// Upload progress when it's supported.
		/* v8 ignore next -- legacy: a live browser XMLHttpRequest always exposes `upload`, so the no-progress-support branch is unreachable */
		if (xhr.upload) {
			xhr.upload.addEventListener('progress', evt => {
				if (evt.lengthComputable) {
					loader.uploadTotal = evt.total;
					loader.uploaded = evt.loaded;
				}
			});
		}
	}

	/**
	 * Prepares the data and sends the request.
	 *
	 * @private
	 */
	async _sendRequest() {
		// Prepare form data.
		const data = new FormData();

        const file = await this.loader.file;
        if (file) {
            data.append('upload', file);

            // Send request.
            this.xhr?.send(data);
        }
	}
}

/**
 * Explains why an upload the server answered did not produce an attachment.
 *
 * The response is parsed as JSON, so anything that rejects the request before it reaches Trilium —
 * a reverse proxy enforcing its own body-size limit, most commonly — leaves nothing to quote and
 * only the status code says what happened. Reporting it beats the bare "cannot upload" that used
 * to be the only thing such a failure produced (#10859).
 *
 * @param status the HTTP status of the response.
 * @param response the parsed response body, `null` when it was not JSON.
 * @returns a sentence to append to the generic error, or an empty string when there is nothing to
 *          add.
 */
function describeUploadFailure(t: LocaleTranslate, status: number, response: { error?: { message?: string } } | null): string {
	const serverMessage = response?.error?.message;
	if (serverMessage) {
		return serverMessage;
	}

	if (status === 413) {
		return t('The file is too large to be uploaded (HTTP 413). If Trilium is behind a reverse proxy, raise its request body size limit.');
	}

	if (status) {
		return t('The server responded with HTTP %0.', String(status));
	}

	return '';
}
