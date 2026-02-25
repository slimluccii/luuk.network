interface ProxyResponse {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
    isBase64Encoded?: boolean;
}
export declare function serveStaticAsset(rawPath: string, storageBaseUrl: string): Promise<ProxyResponse>;
export {};
//# sourceMappingURL=serveStaticAsset.d.ts.map