export default {
  issuer: `https://accounts.google.com/o/oauth2/v2/auth`,
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  //scopes: "email",
  // Set scopes to 'openid' makes idtoken as compact as possible
  scopes: "openid",
  redirectUri: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_REDIRECTURI,
};
