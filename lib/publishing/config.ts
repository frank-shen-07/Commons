import "server-only";
export class PortalError extends Error { constructor(message: string, public status = 400) { super(message); } }
