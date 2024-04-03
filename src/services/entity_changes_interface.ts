export interface EntityChange {
	id?: number | null;
	noteId?: string;
	entityName: string;
	entityId: string;
	entity?: any;
	positions?: Record<string, number>;
	hash: string;
	utcDateChanged?: string;
	utcDateModified?: string;
	utcDateCreated?: string;
	isSynced: boolean | 1 | 0;
	isErased: boolean | 1 | 0;
	componentId?: string | null;
	changeId?: string | null;
	instanceId?: string | null;
}

export interface EntityRow {
	isDeleted?: boolean;
	content?: Buffer | string;
}

export interface EntityChangeRecord {
	entityChange: EntityChange;
	entity?: EntityRow;
}
