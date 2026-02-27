import { PublicClientApplication } from '@azure/msal-node';

async function extractToken() {
    console.log("Starting Token Extraction Helper...");

    // We will use standard NodeJS tools here rather than Playwright since this is just getting a token
    const pca = new PublicClientApplication({
        auth: {
            clientId: process.env.VITE_AAD_CLIENT_ID || '0d704aa1-d263-4e76-afac-f96d92dce620',
            authority: `https://login.microsoftonline.com/${process.env.VITE_AAD_TENANT_ID || '650ea331-3451-4bd8-8b5d-b88cc49e6144'}`,
        },
        system: {
            loggerOptions: {
                loggerCallback: (level, message, containsPii) => {
                    if (containsPii) return;
                    console.log(message);
                }
            }
        }
    });

    try {
        const response = await pca.acquireTokenByDeviceCode({
            scopes: ["https://isogokatudouhome.sharepoint.com/AllSites.Read"],
            deviceCodeCallback: (deviceCodeResponse) => {
                console.log("\n============================================");
                console.log("🔐 PLEASE AUTHENTICATE TO GET THE TOKEN 🔐");
                console.log("============================================");
                console.log(`1. Open this URL in your browser: ${deviceCodeResponse.verificationUri}`);
                console.log(`2. Enter this code: ${deviceCodeResponse.userCode}`);
                console.log("============================================\n");
                console.log("Waiting for you to complete authentication in the browser...");
            }
        });

        console.log("\n✅ SUCCESS! Token Acquired.\n");
        console.log("Add this to your .env.local file:");
        console.log(`SMOKE_TEST_BEARER_TOKEN=${response?.accessToken}`);
        console.log("\n-------------------------------------------");
    } catch (e) {
        console.error("Failed to acquire token:", e);
    }
}

extractToken().catch(console.error);
