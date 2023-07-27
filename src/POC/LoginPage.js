import React from "react";
import {
  TextField,
  PrimaryButton,
  MessageBar,
  MessageBarType,
} from "office-ui-fabric-react";
import { Features } from "@azure/communication-calling";
import { utils } from "../Utils/Utils";
import { v4 as uuid } from "uuid";
import OneSignal from "react-onesignal";
import * as config from "../../clientConfig.json";
import {
  AzureCommunicationTokenCredential,
  createIdentifierFromRawId,
} from "@azure/communication-common";
import { setLogLevel } from "@azure/logger";
import { CallClient } from "@azure/communication-calling";
import { RoomsClient } from "@azure/communication-rooms";
import { Navigate } from "react-router-dom";
import { RouteConfig } from "../routes";

export default class Login extends React.Component {
  constructor(props) {
    super(props);
    this.callAgent = undefined;
    this.callClient = undefined;
    this.roomsClient = null;
    this.userDetailsResponse = undefined;
    this.displayName = undefined;
    this.clientTag = uuid();
    this.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    this._callAgentInitPromise = undefined;
    this._callAgentInitPromiseResolve = undefined;
    this.currentCustomTurnConfig = undefined;
    this.teamsUserEmail = "";
    this.teamsUserPassword = "";
    this.users = [
      {
        name: "Hélène",
        user: {
          communicationUserId:
            "8:acs:dd0b5bea-6374-415a-a991-c5e791770a22_0000001a-3646-6502-9eaf-473a0d00e08d",
        },
      },
      {
        name: "Guillaume",
        user: {
          communicationUserId:
            "8:acs:dd0b5bea-6374-415a-a991-c5e791770a22_0000001a-3646-cdd4-9eaf-473a0d00e09e",
        },
      },
    ];

    this.state = {
      isCallClientActiveInAnotherTab: false,
      environmentInfo: undefined,
      showCallClientOptions: false,
      initializedOneSignal: false,
      subscribedForPushNotifications: false,
      initializeCallAgentAfterPushRegistration: true,
      showSpinner: false,
      loginWarningMessage: undefined,
      loginErrorMessage: undefined,
      proxy: {
        useProxy: false,
        url: "",
      },
      customTurn: {
        useCustomTurn: false,
        isLoading: false,
        turn: null,
      },
      isTeamsUser: false,
      redirect: false,
    };
  }

  async componentDidMount() {
    try {
      if (config.oneSignalAppId) {
        if (location.protocol !== "https:") {
          throw new Error(
            "Web push notifications can only be tested on trusted HTTPS."
          );
        }

        await OneSignal.init({
          appId: config.oneSignalAppId,
          safari_web_id: config.oneSignalSafariWebId,
          notifyButton: {
            enable: true,
            colors: {
              "circle.background": "#ca5010",
            },
          },
        });

        OneSignal.addListenerForNotificationOpened(
          async function (event) {
            console.log(
              "Push notification clicked and app will open if it is currently closed"
            );
            await this.handlePushNotification(event);
          }.bind(this)
        );

        OneSignal.on(
          "notificationDisplay",
          async function (event) {
            console.log("Push notification displayed");
            await this.handlePushNotification(event);
          }.bind(this)
        );

        OneSignal.on(
          "subscriptionChange",
          async function (isSubscribed) {
            console.log(
              "Push notification subscription state is now: ",
              isSubscribed
            );
            this.setState({
              subscribedForPushNotifications:
                (await OneSignal.isPushNotificationsEnabled()) &&
                (await OneSignal.getSubscription()),
            });
          }.bind(this)
        );

        this.setState({ initializedOneSignal: true });
        this.setState({
          subscribedForPushNotifications:
            (await OneSignal.isPushNotificationsEnabled()) &&
            (await OneSignal.getSubscription()),
        });

        await OneSignal.registerForPushNotifications();
      }
    } catch (error) {
      this.setState({
        loginWarningMessage: error.message,
      });
      console.warn(error);
    }
  }

  async setupLoginStates() {
    this.setState({
      token: this.userDetailsResponse.communicationUserToken.token,
    });
    this.setState({
      communicationUserId: utils.getIdentifierText(
        this.userDetailsResponse.userId
      ),
    });

    if (
      !this.state.subscribedForPushNotifications ||
      (this.state.subscribedForPushNotifications &&
        this.state.initializeCallAgentAfterPushRegistration)
    ) {
      const existingUser = this.users.find(
        (u) =>
          u.user.communicationUserId ===
          this.userDetailsResponse.userId.communicationUserId
      );
      await this.handleLogIn({
        communicationUserId:
          this.userDetailsResponse.userId.communicationUserId,
        token: this.userDetailsResponse.communicationUserToken.token,
        displayName: existingUser ? existingUser.name : this.displayName,
        clientTag: this.clientTag,
        proxy: this.state.proxy,
        customTurn: this.state.customTurn,
        isTeamsUser: this.state.isTeamsUser,
      });
    }
    console.log("Login response: ", this.userDetailsResponse);
    this.setState({ loggedIn: true });
  }

  async logIn() {
    try {
      this.setState({ isTeamsUser: false });
      this.setState({ showSpinner: true });
      if (!this.state.token && !this.state.communicationUserId) {
        this.userDetailsResponse = await utils.getCommunicationUserToken();
      } else if (this.state.token && this.state.communicationUserId) {
        this.userDetailsResponse =
          await utils.getOneSignalRegistrationTokenForCommunicationUserToken(
            this.state.token,
            this.state.communicationUserId
          );
      } else if (!this.state.token && this.state.communicationUserId) {
        this.userDetailsResponse = await utils.getCommunicationUserToken(
          this.state.communicationUserId
        );
      } else if (this.state.token && !this.state.communicationUserId) {
        throw new Error(
          "You must specify the associated ACS identity for the provided ACS communication user token"
        );
      }
      if (this.state.initializedOneSignal) {
        OneSignal.setExternalUserId(
          this.userDetailsResponse.oneSignalRegistrationToken
        );
      }
      await this.setupLoginStates();

      this.setState({ redirect: true });
    } catch (error) {
      this.setState({
        loginErrorMessage: error.message,
      });
      console.log(error);
    } finally {
      this.setState({ showSpinner: false });
    }
  }

  async initRooms() {
    try {
      const connectionString =
        "endpoint=https://acs-ptc-poc.communication.azure.com/;accesskey=9HcYVEL6vK+bHhff1quj5CSh6hd2ezP9dAykvR1lvZVC8+fTWPiE7utihsorGOSHVQovO7Lf9wI0XNYPwr6cRw==";
      this.roomsClient = new RoomsClient(connectionString);
      // create identities for users
      //const identityClient = new CommunicationIdentityClient(connectionString);
      //const user1 = await identityClient.createUserAndToken(["voip"]);
      //const user2 = await identityClient.createUserAndToken(["voip"]);

      const participants = [
        {
          id: this.users[0].user,
          role: "Presenter",
        },
        {
          id: this.users[1].user,
          role: "Attendee",
        },
      ];

      // Create a room
      const validFrom = new Date(Date.now());
      const now = new Date(Date.now());
      const validUntil = new Date(now.setMonth(now.getMonth() + 5));

      const createRoomOptions = {
        validFrom,
        validUntil,
        participants,
      };

      const createRoom = await this.roomsClient.createRoom(createRoomOptions);
      this.createdRoomId = createRoom.id;
      console.log("\nCreated a room with id: ", this.createdRoomId);
      /*console.log("User 1: ", participants[0].id);
      console.log("User 2: ", participants[1].id);*/

      const roomsList = await this.roomsClient.listRooms();
      console.log("\nRetrieved list of rooms; printing first room:");
      for await (const currentRoom of roomsList) {
        // access room data here
        console.log(currentRoom);
        break;
      }
    } catch (e) {
      console.error("Failed to init a room", e);
    }
  }

  async handlePushNotification(event) {
    try {
      if (!this.callAgent && !!event.data.incomingCallContext) {
        if (!this.state.token) {
          const oneSignalRegistrationToken =
            await OneSignal.getExternalUserId();
          this.userDetailsResponse =
            await utils.getCommunicationUserTokenForOneSignalRegistrationToken(
              oneSignalRegistrationToken
            );
          this.setState({
            token: this.userDetailsResponse.communicationUserToken.token,
          });
          this.setState({
            communicationUserId: utils.getIdentifierText(
              this.userDetailsResponse.userId.communicationUserId
            ),
          });
        }
        this.handleLogIn({
          communicationUserId:
            this.userDetailsResponse.communicationUserToken.user
              .communicationUserId,
          token: this.userDetailsResponse.communicationUserToken.token,
          displayName: this.displayName,
          clientTag: this.clientTag,
          proxy: this.state.proxy,
          customTurn: this.state.customTurn,
        });
        this._callAgentInitPromise = new Promise((resolve) => {
          this._callAgentInitPromiseResolve = resolve;
        });
        await this._callAgentInitPromise;
        console.log("Login response: ", this.userDetailsResponse);
        this.setState({ loggedIn: true });
        if (!this.callAgent.handlePushNotification) {
          throw new Error(
            "Handle push notification feature is not implemented in ACS Web Calling SDK yet."
          );
        }
        await this.callAgent.handlePushNotification(event.data);
      }
    } catch (error) {
      this.setState({
        loginErrorMessage: error.message,
      });
      console.log(error);
    }
  }

  handleLogIn = async (userDetails) => {
    if (userDetails) {
      try {
        const tokenCredential = new AzureCommunicationTokenCredential(
          userDetails.token
        );
        this.tokenCredential = tokenCredential;
        setLogLevel("verbose");

        const proxyConfiguration = userDetails.proxy.useProxy
          ? { url: userDetails.proxy.url }
          : undefined;
        const turnConfiguration =
          userDetails.customTurn.useCustomTurn &&
          !userDetails.customTurn.isLoading
            ? userDetails.customTurn.turn
            : undefined;
        this.callClient = new CallClient({
          diagnostics: {
            appName: "azure-communication-services",
            appVersion: "1.3.1-beta.1",
            tags: [
              "javascript_calling_sdk",
              `#clientTag:${userDetails.clientTag}`,
            ],
          },
          networkConfiguration: {
            proxy: proxyConfiguration,
            turn: turnConfiguration,
          },
        });

        this.deviceManager = await this.callClient.getDeviceManager();
        const permissions = await this.deviceManager.askDevicePermission({
          audio: true,
          video: true,
        });
        this.setState({ permissions: permissions });

        this.setState({ isTeamsUser: userDetails.isTeamsUser });
        this.setState({
          identityMri: createIdentifierFromRawId(
            userDetails.communicationUserId
          ),
        });
        this.callAgent = this.state.isTeamsUser
          ? await this.callClient.createTeamsCallAgent(tokenCredential)
          : await this.callClient.createCallAgent(tokenCredential, {
              displayName: userDetails.displayName,
            });

        this.callAgent.on("callsUpdated", (e) => {
          console.log(`callsUpdated, added=${e.added}, removed=${e.removed}`);

          e.added.forEach((call) => {
            this.setState({ call: call });

            const diagnosticChangedListener = (diagnosticInfo) => {
              const rmsg = `UFD Diagnostic changed:
                            Diagnostic: ${diagnosticInfo.diagnostic}
                            Value: ${diagnosticInfo.value}
                            Value type: ${diagnosticInfo.valueType}`;
              if (this.state.ufdMessages.length > 0) {
                this.setState({
                  ufdMessages: [...this.state.ufdMessages, rmsg],
                });
              } else {
                this.setState({ ufdMessages: [rmsg] });
              }
            };

            call
              .feature(Features.UserFacingDiagnostics)
              .media.on("diagnosticChanged", diagnosticChangedListener);
            call
              .feature(Features.UserFacingDiagnostics)
              .network.on("diagnosticChanged", diagnosticChangedListener);
          });

          e.removed.forEach((call) => {
            if (this.state.call && this.state.call === call) {
              this.displayCallEndReason(this.state.call.callEndReason);
            }
          });
        });
        this.callAgent.on("incomingCall", (args) => {
          const incomingCall = args.incomingCall;
          if (this.state.call) {
            incomingCall.reject();
            return;
          }

          this.setState({ incomingCall: incomingCall });

          incomingCall.on("callEnded", (args) => {
            this.displayCallEndReason(args.callEndReason);
          });
        });
        this.setState({ loggedIn: true });
        this.setCallAgent(this.callAgent);
        this.setCallClient(this.callClient);
      } catch (e) {
        console.error(e);
      }
    }
  };

  setCallAgent(callAgent) {
    this.callAgent = callAgent;
    if (this._callAgentInitPromiseResolve) {
      this._callAgentInitPromiseResolve();
    }
  }

  async setCallClient(callClient) {
    this.callClient = callClient;
    const environmentInfo = await this.callClient.getEnvironmentInfoInternal();
    this.setState({ environmentInfo });
    const debugInfoFeature = await this.callClient.feature(Features.DebugInfo);
    this.setState({
      isCallClientActiveInAnotherTab:
        debugInfoFeature.isCallClientActiveInAnotherTab,
    });
    debugInfoFeature.on("isCallClientActiveInAnotherTabChanged", () => {
      this.setState({
        isCallClientActiveInAnotherTab:
          debugInfoFeature.isCallClientActiveInAnotherTab,
      });
    });
  }

  render() {
    return (
      <div className="card">
        <div className="ms-Grid">
          <div className="ms-Grid-row">
            {this.state.loginWarningMessage && (
              <MessageBar
                className="mb-2"
                messageBarType={MessageBarType.warning}
                isMultiline={true}
                onDismiss={() => {
                  this.setState({ loginWarningMessage: undefined });
                }}
                dismissButtonAriaLabel="Close"
              >
                <b>{this.state.loginWarningMessage}</b>
              </MessageBar>
            )}
          </div>
          <div className="ms-Grid-row">
            {this.state.loginErrorMessage && (
              <MessageBar
                className="mb-2"
                messageBarType={MessageBarType.error}
                isMultiline={true}
                onDismiss={() => {
                  this.setState({ loginErrorMessage: undefined });
                }}
                dismissButtonAriaLabel="Close"
              >
                <b>{this.state.loginErrorMessage}</b>
              </MessageBar>
            )}
          </div>
          {this.state.showSpinner && (
            <div className="justify-content-left mt-4">
              <div className="loader inline-block"> </div>
              <div className="ml-2 inline-block">Initializing SDK...</div>
            </div>
          )}
          {!this.state.showSpinner && !this.state.loggedIn && (
            <div>
              <div className="ms-Grid-row">
                <div className="ms-Grid-col">
                  <h3>Log In</h3>
                </div>
              </div>
              <div className="ms-Grid-row">
                <div className="ms-Grid-col ms-sm12 ms-md12 ms-lg12">
                  <TextField
                    placeholder="8:acs:<ACS Resource ID>_<guid>"
                    label="ACS Identity"
                    onChange={(e) => {
                      this.state.communicationUserId = e.target.value;
                    }}
                  />
                </div>
              </div>
              <div className="ms-Grid-row">
                <div className="ms-Grid-col ms-sm12 ms-md12 ms-lg12">
                  <PrimaryButton
                    className="primary-button mt-4"
                    label="Provision an user"
                    onClick={() => this.logIn()}
                  >
                    Log In
                  </PrimaryButton>
                </div>
              </div>
              {/*
              <div className="ms-Grid-row">
                <div className="ms-Grid-col ms-sm12 ms-md12 ms-lg12">
                  <PrimaryButton
                    className="primary-button mt-4"
                    label="Create a room"
                    onClick={() => this.initRooms()}
                  >
                    Create room
                  </PrimaryButton>
                </div>
                  </div>*/}
            </div>
          )}
        </div>
        {this.state.redirect && <Navigate to="/projects" replace={true} />}
      </div>
    );
  }
}
