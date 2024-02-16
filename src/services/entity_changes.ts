export interface EntityChange {
	id?: string;
	entityName: string;
	entityId: string;
	hash: string;
	utcDateChanged: string;
	isSynced: boolean | 1 | 0;
	isErased: boolean | 1 | 0;
	componentId?: string | null;
	changeId?: string | null;
	instanceId?: string | null;
}
