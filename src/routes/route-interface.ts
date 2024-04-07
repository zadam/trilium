import { Request } from "express";

export interface AppRequest extends Request {
    headers: {
        authorization?: string;
        "trilium-cred"?: string;
    }
    session: {
        loggedIn: boolean;   
        cookie: {
            maxAge: number;
            expires: boolean
        };
        regenerate: (callback: () => void) => void;     
    }
}