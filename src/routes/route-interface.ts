import { NextFunction, Request, Response } from "express";
import { Session, SessionData } from "express-session";

export interface AppRequest extends Request {
    headers: {
        authorization?: string;
        "trilium-cred"?: string;
        "x-local-date"?: string;
        "x-labels"?: string;
        "trilium-local-now-datetime"?: string;
    }
    session: Session & Partial<SessionData> & {
        loggedIn: boolean;
    }
}

export type AppRequestHandler = (
    req: AppRequest,
    res: Response,
    next: NextFunction
) => void;