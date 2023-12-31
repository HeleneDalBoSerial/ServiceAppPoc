const CommunicationIdentityClient =
  require("@azure/communication-identity").CommunicationIdentityClient;
const AzureCommunicationTokenCredential =
  require("@azure/communication-common").AzureCommunicationTokenCredential;
const ChatClient = require("@azure/communication-chat").ChatClient;
const HtmlWebPackPlugin = require("html-webpack-plugin");
const config = require("./serverConfig.json");
const clientConfig = require("./clientConfig.json");
const axios = require("axios");
const bodyParser = require("body-parser");
const CommunicationRelayClient =
  require("@azure/communication-network-traversal").CommunicationRelayClient;
const msal = require("@azure/msal-node");

const { authConfig, authScopes } = require("./oAuthConfig");
const clientId = authConfig.auth.clientId;

if (
  !config ||
  !config.connectionString ||
  config.connectionString.indexOf("endpoint=") === -1
) {
  throw new Error("Update `serverConfig.json` with connection string");
}

const communicationIdentityClient = new CommunicationIdentityClient(
  config.connectionString
);

const PORT = process.env.port || 8080;

const oneSignalRegistrationTokenToAcsUserAccesTokenMap = new Map();
const registerCommunicationUserForOneSignal = async (
  communicationAccessToken,
  communicationUserIdentifier
) => {
  const oneSignalRegistrationToken = generateGuid();
  await axios({
    url: config.functionAppOneSignalTokenRegistrationUrl,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    data: JSON.stringify({
      communicationUserId: communicationUserIdentifier.communicationUserId,
      oneSignalRegistrationToken,
      oneSignalAppId: clientConfig.oneSignalAppId,
    }),
  }).then((response) => {
    return response.data;
  });
  oneSignalRegistrationTokenToAcsUserAccesTokenMap.set(
    oneSignalRegistrationToken,
    { communicationAccessToken, communicationUserIdentifier }
  );
  return oneSignalRegistrationToken;
};

const generateGuid = function () {
  function s4() {
    return Math.floor((Math.random() + 1) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
};

const parseJWT = (token) => {
  let [, payload] = token?.split(".");
  if (payload != undefined) {
    payload = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(payload))));
  }
  return "";
};

// Exchanging Azure AD access token of a Teams User for a Communication access token
// https://learn.microsoft.com/en-us/azure/communication-services/quickstarts/manage-teams-identity?pivots=programming-language-javascript
const getACSAccessTokenInfo = async (aadToken, userObjectId) => {
  let acsToken;
  try {
    acsToken = await communicationIdentityClient.getTokenForTeamsUser({
      teamsUserAadToken: aadToken,
      clientId,
      userObjectId: userObjectId,
    });
  } catch (e) {
    console.log("ERROR", e);
    throw e;
  }

  let parsedToken = parseJWT(acsToken.token);
  if (parsedToken == "") {
    throw " Parsed Token is empty";
  }
  const mri = `8:${parsedToken.skypeid}`;
  const tokenResponse = {
    token: acsToken.token,
    userId: { communicationUserId: mri },
  };
  return tokenResponse;
};

module.exports = {
  devtool: "inline-source-map",
  mode: "development",
  entry: "./src/index.js",
  output: {
    publicPath: "/",
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        use: {
          loader: "babel-loader",
          options: {
            plugins: ["@babel/plugin-proposal-export-namespace-from"],
          },
        },
      },
      {
        test: /\.(ts|tsx)?$/,
        use: {
          loader: "babel-loader",
          options: {
            plugins: ["@babel/plugin-proposal-export-namespace-from"],
          },
        },
      },
      {
        test: /\.html$/,
        use: [
          {
            loader: "html-loader",
          },
        ],
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebPackPlugin({
      template: "./public/index.html",
      filename: "./index.html",
    }),
  ],
  devServer: {
    open: true,
    port: PORT,
    historyApiFallback: true,
    contentBase: "./public",
    allowedHosts: ["waserviceapppoc.azurewebsites.net"],
    before: function (app) {
      app.use(bodyParser.json());
      app.post("/getCommunicationUserToken", async (req, res) => {
        const users = new Map([
          [
            "helene@test.com",
            "8:acs:dd0b5bea-6374-415a-a991-c5e791770a22_0000001a-3646-6502-9eaf-473a0d00e08d",
          ],
          [
            "guillaume@test.com",
            "8:acs:dd0b5bea-6374-415a-a991-c5e791770a22_0000001a-3646-cdd4-9eaf-473a0d00e09e",
          ],
          [
            "janedoe@test.com",
            "8:acs:dd0b5bea-6374-415a-a991-c5e791770a22_0000001a-6f06-2685-f4f3-ad3a0d002036",
          ],
        ]);
        try {
          const login = req.body.login;
          const communicationUserId = users.get(login);
          let CommunicationUserIdentifier;
          if (!communicationUserId) {
            // CommunicationUserIdentifier = await communicationIdentityClient.createUser();
            throw "Wrong login";
          } else {
            CommunicationUserIdentifier = {
              communicationUserId: communicationUserId,
            };
          }
          const communicationUserToken =
            await communicationIdentityClient.getToken(
              CommunicationUserIdentifier,
              ["chat", "voip"]
            );
          let oneSignalRegistrationToken;
          if (config.functionAppOneSignalTokenRegistrationUrl) {
            oneSignalRegistrationToken =
              await registerCommunicationUserForOneSignal(
                communicationUserToken,
                CommunicationUserIdentifier
              );
          }
          res.setHeader("Content-Type", "application/json");
          res.status(200).json({
            communicationUserToken,
            oneSignalRegistrationToken,
            userId: CommunicationUserIdentifier,
          });
        } catch (e) {
          if (e === "Wrong login") {
            res.sendStatus(403);
          } else {
            res.sendStatus(500);
          }
          console.log("Error setting registration token", e);
        }
      });
      app.post(
        "/getCommunicationUserTokenForOneSignalRegistrationToken",
        async (req, res) => {
          try {
            const oneSignalRegistrationToken =
              req.body.oneSignalRegistrationToken;
            const { communicationUserToken, communicationUserIdentifier } =
              oneSignalRegistrationTokenToAcsUserAccesTokenMap.get(
                oneSignalRegistrationToken
              );
            res.setHeader("Content-Type", "application/json");
            res.status(200).json({
              communicationUserToken,
              userId: communicationUserIdentifier,
              oneSignalRegistrationToken,
            });
          } catch (e) {
            console.log("Error setting registration token", e);
            res.sendStatus(500);
          }
        }
      );
      app.post(
        "/getOneSignalRegistrationTokenForCommunicationUserToken",
        async (req, res) => {
          try {
            const communicationUserToken = { token: req.body.token };
            const communicationUserIdentifier = {
              communicationUserId: req.body.communicationUserId,
            };

            if (!config.functionAppOneSignalTokenRegistrationUrl) {
              res.setHeader("Content-Type", "application/json");
              res.status(200).json({
                communicationUserToken,
                userId: communicationUserIdentifier,
              });
              return;
            }

            let pair = [
              ...oneSignalRegistrationTokenToAcsUserAccesTokenMap.entries(),
            ].find((pair) => {
              return (
                pair[1].token === communicationUserToken.token &&
                pair[1].communicationUserId ===
                  communicationUserIdentifier.communicationUserId
              );
            });
            let oneSignalRegistrationToken;
            if (pair) {
              oneSignalRegistrationToken = pair[0];
            } else {
              oneSignalRegistrationToken =
                await registerCommunicationUserForOneSignal(
                  communicationUserToken,
                  communicationUserIdentifier
                );
            }
            res.setHeader("Content-Type", "application/json");
            res.status(200).json({
              communicationUserToken,
              userId: communicationUserIdentifier,
              oneSignalRegistrationToken,
            });
          } catch (e) {
            console.log("Error setting registration token", e);
            res.sendStatus(500);
          }
        }
      );
      app.get("/customRelayConfig", async (req, res) => {
        console.log("Requesting custom TURN server configuration");
        try {
          const relayClient = new CommunicationRelayClient(
            config.connectionString
          );
          const relayConfig = await relayClient.getRelayConfiguration();
          if (relayConfig) {
            res.status(200).json({
              relayConfig,
            });
          } else {
            throw "No relay config returned from service";
          }
        } catch (e) {
          console.log(`Error creating custom TURN configuration: ${e}`);
          res.sendStatus(500);
        }
      });
      app.post("/teamsPopupLogin", async (req, res) => {
        try {
          const aadToken = req.body.aadToken;
          const userObjectId = req.body.userObjectId;
          let acsTokenInfo = await getACSAccessTokenInfo(
            aadToken,
            userObjectId
          );
          res.setHeader("Content-Type", "application/json");
          res.status(200).json({
            communicationUserToken: { token: acsTokenInfo.token },
            userId: acsTokenInfo.userId,
          });
        } catch (e) {
          console.error(e);
          res.sendStatus(400);
        }
      });
      app.post("/teamsM365Login", async (req, res) => {
        try {
          const email = req.body.email;
          const password = req.body.password;

          const pca = new msal.PublicClientApplication(authConfig);
          let tokenRequest = { scopes: authScopes.m365Login };

          tokenRequest.username = email;
          tokenRequest.password = password;
          const response = await pca.acquireTokenByUsernamePassword(
            tokenRequest
          );
          let acsTokenInfo = await getACSAccessTokenInfo(
            response.accessToken,
            response.uniqueId
          );

          res.setHeader("Content-Type", "application/json");
          res.status(200).json({
            communicationUserToken: { token: acsTokenInfo.token },
            userId: acsTokenInfo.userId,
          });
        } catch (e) {
          console.error(e);
          res.sendStatus(400);
        }
      });
      app.post("/addUser", async (req, res) => {
        try {
          //const token = req.body.token;
          const threadId = req.body.threadId;
          const userId = req.body.userId;
          const displayName = req.body.displayName;

          let identityClient = undefined;
          const getIdentityClient = () =>
            identityClient ??
            (identityClient = new CommunicationIdentityClient(
              "endpoint=https://acs-ptc-poc.communication.azure.com/;accesskey=9HcYVEL6vK+bHhff1quj5CSh6hd2ezP9dAykvR1lvZVC8+fTWPiE7utihsorGOSHVQovO7Lf9wI0XNYPwr6cRw=="
            ));

          const getToken = (user, scopes) =>
            getIdentityClient().getToken(user, scopes);

          const getAdminUser = () => {
            return {
              communicationUserId:
                "8:acs:dd0b5bea-6374-415a-a991-c5e791770a22_00000019-a6de-2bcc-a7ac-473a0d005e6e",
            };
          };

          const credential = new AzureCommunicationTokenCredential({
            tokenRefresher: async () =>
              (await getToken(getAdminUser(), ["chat", "voip"])).token,
            refreshProactively: true,
          });

          const chatClient = new ChatClient(
            "https://acs-ptc-poc.communication.azure.com",
            credential
          );

          const chatThreadClient = await chatClient.getChatThreadClient(
            threadId
          );

          await chatThreadClient.addParticipants({
            participants: [
              {
                id: { communicationUserId: userId },
                displayName: displayName,
              },
            ],
          });

          res.setHeader("Content-Type", "application/json");
          res.sendStatus(201);
        } catch (e) {
          console.error(e);
          res.sendStatus(404);
        }
      });
    },
  },
};
