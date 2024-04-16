import { Request } from "express";
import { File } from "../services/import/common";

export interface AppRequest extends Request {
    headers: {
        authorization?: string;
        "trilium-cred"?: string;
        "x-local-date"?: string;
        "x-labels"?: string;
    }
    session: {
        loggedIn: boolean;   
        cookie: {
            maxAge: number;
            expires: boolean
        };
        regenerate: (callback: () => void) => void;     
    }
    file: File;
}