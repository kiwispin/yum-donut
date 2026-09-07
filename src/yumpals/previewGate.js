// Convenience visibility for an already-public pretend demo, NOT authorization.
export function canShowYumPalsPreview({ uid, previewUid, isAdmin, isSandbox }) {
    return Boolean(uid && previewUid === uid && isAdmin && !isSandbox);
}
