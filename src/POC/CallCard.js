import React from "react";
import { FunctionalStreamRenderer as StreamRenderer } from "./FunctionalStreamRenderer";
import { Icon } from "@fluentui/react/lib/Icon";
import LocalVideoPreviewCard from "./LocalVideoPreviewCard";
import { LocalVideoStream, Features } from "@azure/communication-calling";
import { utils } from "../Utils/Utils";
import { AzureLogger } from "@azure/logger";

export default class CallCard extends React.Component {
  constructor(props) {
    super(props);
    this.callFinishConnectingResolve = undefined;
    this.call = props.call;
    this.localVideoStream = this.call.localVideoStreams.find((lvs) => {
      return (
        lvs.mediaStreamType === "Video" || lvs.mediaStreamType === "RawMedia"
      );
    });
    this.localScreenSharingStream = undefined;
    this.deviceManager = props.deviceManager;
    this.remoteVolumeLevelSubscription = undefined;
    this.handleRemoteVolumeSubscription = undefined;
    this.streamIsAvailableListeners = new Map();
    this.videoStreamsUpdatedListeners = new Map();
    this.identifier = props.identityMri;
    this.spotlightFeature = this.call.feature(Features.Spotlight);
    this.raiseHandFeature = this.call.feature(Features.RaiseHand);
    this.capabilitiesFeature = this.call.feature(Features.Capabilities);
    this.identifier = props.identityMri;
    this.isTeamsUser = props.isTeamsUser;
    this.dummyStreamTimeout = undefined;
    this.state = {
      ovc: 4,
      callState: this.call.state,
      callId: this.call.id,
      remoteParticipants: [],
      allRemoteParticipantStreams: [],
      remoteScreenShareStream: undefined,
      canOnVideo: true,
      canUnMuteMic: true,
      canShareScreen: true,
      canRaiseHands: true,
      canSpotlight: true,
      videoOn: this.call.isLocalVideoStarted,
      screenSharingOn: this.call.isScreenSharingOn,
      micMuted: this.call.isMuted,
      incomingAudioMuted: false,
      onHold:
        this.call.state === "LocalHold" || this.call.state === "RemoteHold",
      outgoingAudioMediaAccessActive: false,
      cameraDeviceOptions: props.cameraDeviceOptions
        ? props.cameraDeviceOptions
        : [],
      speakerDeviceOptions: props.speakerDeviceOptions
        ? props.speakerDeviceOptions
        : [],
      microphoneDeviceOptions: props.microphoneDeviceOptions
        ? props.microphoneDeviceOptions
        : [],
      selectedCameraDeviceId: props.selectedCameraDeviceId,
      selectedSpeakerDeviceId: this.deviceManager.selectedSpeaker?.id,
      selectedMicrophoneDeviceId: this.deviceManager.selectedMicrophone?.id,
      showSettings: false,
      // StartWithNormal or StartWithDummy
      localScreenSharingMode: undefined,
      callMessage: undefined,
      dominantSpeakerMode: false,
      captionOn: false,
      dominantRemoteParticipant: undefined,
      logMediaStats: false,
      sentResolution: "",
      remoteVolumeIndicator: undefined,
      remoteVolumeLevel: undefined,
      mediaCollector: undefined,
      isSpotlighted: false,
      isHandRaised: false,
      showParticipantsCard: true,
    };
    this.selectedRemoteParticipants = new Set();
    this.dataChannelRef = React.createRef();
  }

  componentWillUnmount() {
    this.call.off("stateChanged", () => {});
    this.deviceManager.off("videoDevicesUpdated", () => {});
    this.deviceManager.off("audioDevicesUpdated", () => {});
    this.deviceManager.off("selectedSpeakerChanged", () => {});
    this.deviceManager.off("selectedMicrophoneChanged", () => {});
    this.call.off("localVideoStreamsUpdated", () => {});
    this.call.off("idChanged", () => {});
    this.call.off("isMutedChanged", () => {});
    this.call.off("isIncomingAudioMutedChanged", () => {});
    this.call.off("isScreenSharingOnChanged", () => {});
    this.call.off("remoteParticipantsUpdated", () => {});
    this.state.mediaCollector?.off("sampleReported", () => {});
    this.state.mediaCollector?.off("summaryReported", () => {});
    this.call
      .feature(Features.DominantSpeakers)
      .off("dominantSpeakersChanged", () => {});
    this.call
      .feature(Features.Spotlight)
      .off("spotlightChanged", this.spotlightStateChangedHandler);
    this.call
      .feature(Features.RaiseHand)
      .off("raisedHandEvent", this.raiseHandChangedHandler);
    this.call
      .feature(Features.RaiseHand)
      .off("loweredHandEvent", this.raiseHandChangedHandler);
  }

  componentDidMount() {
    if (this.call) {
      this.deviceManager.on("videoDevicesUpdated", async (e) => {
        e.added.forEach((addedCameraDevice) => {
          const addedCameraDeviceOption = {
            key: addedCameraDevice.id,
            text: addedCameraDevice.name,
          };
          this.setState((prevState) => ({
            ...prevState,
            cameraDeviceOptions: [
              ...prevState.cameraDeviceOptions,
              addedCameraDeviceOption,
            ],
          }));
        });

        e.removed.forEach(async (removedCameraDevice) => {
          // If the selected camera is removed, select a new camera.
          // Note: When the selected camera is removed, the calling sdk automatically turns video off.
          this.setState(
            (prevState) => ({
              ...prevState,
              cameraDeviceOptions: prevState.cameraDeviceOptions.filter(
                (option) => {
                  return option.key !== removedCameraDevice.id;
                }
              ),
            }),
            () => {
              if (
                removedCameraDevice.id === this.state.selectedCameraDeviceId
              ) {
                this.setState({
                  selectedCameraDeviceId:
                    this.state.cameraDeviceOptions[0]?.key,
                });
              }
            }
          );
        });
      });

      this.deviceManager.on("audioDevicesUpdated", (e) => {
        e.added.forEach((addedAudioDevice) => {
          const addedAudioDeviceOption = {
            key: addedAudioDevice.id,
            text: addedAudioDevice.name,
          };
          if (addedAudioDevice.deviceType === "Speaker") {
            this.setState((prevState) => ({
              ...prevState,
              speakerDeviceOptions: [
                ...prevState.speakerDeviceOptions,
                addedAudioDeviceOption,
              ],
            }));
          } else if (addedAudioDevice.deviceType === "Microphone") {
            this.setState((prevState) => ({
              ...prevState,
              microphoneDeviceOptions: [
                ...prevState.microphoneDeviceOptions,
                addedAudioDeviceOption,
              ],
            }));
          }
        });

        e.removed.forEach((removedAudioDevice) => {
          if (removedAudioDevice.deviceType === "Speaker") {
            this.setState((prevState) => ({
              ...prevState,
              speakerDeviceOptions: prevState.speakerDeviceOptions.filter(
                (option) => {
                  return option.key !== removedAudioDevice.id;
                }
              ),
            }));
          } else if (removedAudioDevice.deviceType === "Microphone") {
            this.setState((prevState) => ({
              ...prevState,
              microphoneDeviceOptions: prevState.microphoneDeviceOptions.filter(
                (option) => {
                  return option.key !== removedAudioDevice.id;
                }
              ),
            }));
          }
        });
      });

      this.deviceManager.on("selectedSpeakerChanged", () => {
        this.setState({
          selectedSpeakerDeviceId: this.deviceManager.selectedSpeaker?.id,
        });
      });

      this.deviceManager.on("selectedMicrophoneChanged", () => {
        this.setState({
          selectedMicrophoneDeviceId: this.deviceManager.selectedMicrophone?.id,
        });
      });

      const callStateChanged = () => {
        console.log("Call state changed ", this.call.state);
        if (
          this.call.state !== "None" &&
          this.call.state !== "Connecting" &&
          this.call.state !== "Incoming"
        ) {
          if (this.callFinishConnectingResolve) {
            this.callFinishConnectingResolve();
          }
        }
        if (this.call.state === "Incoming") {
          this.setState({ selectedCameraDeviceId: cameraDevices[0]?.id });
          this.setState({ selectedSpeakerDeviceId: speakerDevices[0]?.id });
          this.setState({
            selectedMicrophoneDeviceId: microphoneDevices[0]?.id,
          });
        }

        if (this.call.state !== "Disconnected") {
          this.setState({ callState: this.call.state });
        }
      };
      callStateChanged();
      this.call.on("stateChanged", callStateChanged);

      this.call.on("idChanged", () => {
        console.log("Call id Changed ", this.call.id);
        this.setState({ callId: this.call.id });
      });

      this.call.on("isMutedChanged", () => {
        console.log("Local microphone muted changed ", this.call.isMuted);
        this.setState({ micMuted: this.call.isMuted });
      });

      this.call.on("isIncomingAudioMutedChanged", () => {
        console.log(
          "Incoming audio muted changed  ",
          this.call.isIncomingAudioMuted
        );
        this.setState({ incomingAudioMuted: this.call.isIncomingAudioMuted });
      });

      this.call.on("isLocalVideoStartedChanged", () => {
        this.setState({ videoOn: this.call.isLocalVideoStarted });
      });

      this.call.on("isScreenSharingOnChanged", () => {
        this.setState({ screenSharingOn: this.call.isScreenSharingOn });
        if (!this.call.isScreenSharing) {
          if (this.state.localScreenSharingMode == "StartWithDummy") {
            clearTimeout(this.dummyStreamTimeout);
            this.dummyStreamTimeout = undefined;
          }
          this.setState({ localScreenSharingMode: undefined });
        }
      });

      const handleParticipant = (participant) => {
        if (
          !this.state.remoteParticipants.find((p) => {
            return p === participant;
          })
        ) {
          this.setState(
            (prevState) => ({
              ...prevState,
              remoteParticipants: [
                ...prevState.remoteParticipants,
                participant,
              ],
            }),
            () => {
              const handleVideoStreamAdded = (vs) => {
                if (vs.isAvailable)
                  this.updateListOfParticipantsToRender("streamIsAvailable");
                const isAvailableChangedListener = () => {
                  this.updateListOfParticipantsToRender(
                    "streamIsAvailableChanged"
                  );
                };
                this.streamIsAvailableListeners.set(
                  vs,
                  isAvailableChangedListener
                );
                vs.on("isAvailableChanged", isAvailableChangedListener);
              };

              participant.videoStreams.forEach(handleVideoStreamAdded);

              const videoStreamsUpdatedListener = (e) => {
                e.added.forEach(handleVideoStreamAdded);
                e.removed.forEach((vs) => {
                  this.updateListOfParticipantsToRender("videoStreamsRemoved");
                  const streamIsAvailableListener =
                    this.streamIsAvailableListeners.get(vs);
                  if (streamIsAvailableListener) {
                    vs.off("isAvailableChanged", streamIsAvailableListener);
                    this.streamIsAvailableListeners.delete(vs);
                  }
                });
              };
              this.videoStreamsUpdatedListeners.set(
                participant,
                videoStreamsUpdatedListener
              );
              participant.on(
                "videoStreamsUpdated",
                videoStreamsUpdatedListener
              );
            }
          );
        }
      };

      this.call.remoteParticipants.forEach((rp) => handleParticipant(rp));

      this.call.on("remoteParticipantsUpdated", (e) => {
        console.log(
          `Call=${this.call.callId}, remoteParticipantsUpdated, added=${e.added}, removed=${e.removed}`
        );
        e.added.forEach((participant) => {
          console.log("participantAdded", participant);
          handleParticipant(participant);
        });
        e.removed.forEach((participant) => {
          console.log("participantRemoved", participant);
          if (participant.callEndReason) {
            this.setState((prevState) => ({
              ...prevState,
              callMessage: `${
                prevState.callMessage ? prevState.callMessage + `\n` : ``
              }
                                        Remote participant ${utils.getIdentifierText(
                                          participant.identifier
                                        )} disconnected: code: ${
                participant.callEndReason.code
              }, subCode: ${participant.callEndReason.subCode}.`,
            }));
          }
          this.setState({
            remoteParticipants: this.state.remoteParticipants.filter((p) => {
              return p !== participant;
            }),
          });
          this.updateListOfParticipantsToRender("participantRemoved");
          const videoStreamUpdatedListener =
            this.videoStreamsUpdatedListeners.get(participant);
          if (videoStreamUpdatedListener) {
            participant.off("videoStreamsUpdated", videoStreamUpdatedListener);
            this.videoStreamsUpdatedListeners.delete(participant);
          }
          participant.videoStreams.forEach((vs) => {
            const streamIsAvailableListener =
              this.streamIsAvailableListeners.get(vs);
            if (streamIsAvailableListener) {
              vs.off("isAvailableChanged", streamIsAvailableListener);
              this.streamIsAvailableListeners.delete(vs);
            }
          });
        });
      });
      const mediaCollector = this.call
        .feature(Features.MediaStats)
        .createCollector();
      this.setState({ mediaCollector });
      mediaCollector.on("sampleReported", (data) => {
        if (this.state.logMediaStats) {
          AzureLogger.log(
            `${new Date().toISOString()} MediaStats sample: ${JSON.stringify(
              data
            )}`
          );
        }
        let sentResolution = "";
        if (data?.video?.send?.length) {
          if (
            data.video.send[0].frameWidthSent &&
            data.video.send[0].frameHeightSent
          ) {
            sentResolution = `${data.video.send[0].frameWidthSent}x${data.video.send[0].frameHeightSent}`;
          }
        }
        if (this.state.sentResolution !== sentResolution) {
          this.setState({ sentResolution });
        }
        let stats = {};
        if (this.state.logMediaStats) {
          if (data?.video?.receive?.length) {
            data.video.receive.forEach((v) => {
              stats[v.streamId] = v;
            });
          }
          if (data?.screenShare?.receive?.length) {
            data.screenShare.receive.forEach((v) => {
              stats[v.streamId] = v;
            });
          }
        }
        this.state.allRemoteParticipantStreams.forEach((v) => {
          let renderer = v.streamRendererComponentRef.current;
          renderer?.updateReceiveStats(stats[v.stream.id]);
        });
      });
      mediaCollector.on("summaryReported", (data) => {
        if (this.state.logMediaStats) {
          AzureLogger.log(
            `${new Date().toISOString()} MediaStats summary: ${JSON.stringify(
              data
            )}`
          );
        }
      });

      const dominantSpeakersChangedHandler = async () => {
        try {
          if (this.state.dominantSpeakerMode) {
            const newDominantSpeakerIdentifier = this.call.feature(
              Features.DominantSpeakers
            ).dominantSpeakers.speakersList[0];
            if (newDominantSpeakerIdentifier) {
              console.log(
                `DominantSpeaker changed, new dominant speaker: ${
                  newDominantSpeakerIdentifier
                    ? utils.getIdentifierText(newDominantSpeakerIdentifier)
                    : `None`
                }`
              );

              // Set the new dominant remote participant
              const newDominantRemoteParticipant =
                utils.getRemoteParticipantObjFromIdentifier(
                  this.call,
                  newDominantSpeakerIdentifier
                );

              // Get the new dominant remote participant's stream tuples
              const streamsToRender = [];
              for (const streamTuple of this.state
                .allRemoteParticipantStreams) {
                if (
                  streamTuple.participant === newDominantRemoteParticipant &&
                  streamTuple.stream.isAvailable
                ) {
                  streamsToRender.push(streamTuple);
                  if (
                    !streamTuple.streamRendererComponentRef.current.getRenderer()
                  ) {
                    await streamTuple.streamRendererComponentRef.current.createRenderer();
                  }
                }
              }

              const previousDominantSpeaker =
                this.state.dominantRemoteParticipant;
              this.setState({
                dominantRemoteParticipant: newDominantRemoteParticipant,
              });

              if (previousDominantSpeaker) {
                // Remove the old dominant remote participant's streams
                this.state.allRemoteParticipantStreams.forEach(
                  (streamTuple) => {
                    if (streamTuple.participant === previousDominantSpeaker) {
                      streamTuple.streamRendererComponentRef.current.disposeRenderer();
                    }
                  }
                );
              }

              // Render the new dominany speaker's streams
              streamsToRender.forEach((streamTuple) => {
                streamTuple.streamRendererComponentRef.current.attachRenderer();
              });
            } else {
              console.warn("New dominant speaker is undefined");
            }
          }
        } catch (error) {
          console.error(error);
        }
      };

      const dominantSpeakerIdentifier = this.call.feature(
        Features.DominantSpeakers
      ).dominantSpeakers.speakersList[0];
      if (dominantSpeakerIdentifier) {
        this.setState({
          dominantRemoteParticipant:
            utils.getRemoteParticipantObjFromIdentifier(
              dominantSpeakerIdentifier
            ),
        });
      }
      this.call
        .feature(Features.DominantSpeakers)
        .on("dominantSpeakersChanged", dominantSpeakersChangedHandler);

      const ovcFeature = this.call.feature(Features.OptimalVideoCount);
      const ovcChangedHandler = () => {
        if (this.state.ovc !== ovcFeature.optimalVideoCount) {
          this.setState({ ovc: ovcFeature.optimalVideoCount });
          this.updateListOfParticipantsToRender("optimalVideoCountChanged");
        }
      };
      ovcFeature?.on("optimalVideoCountChanged", () => ovcChangedHandler());
      this.spotlightFeature.on(
        "spotlightChanged",
        this.spotlightStateChangedHandler
      );
      this.raiseHandFeature.on(
        "loweredHandEvent",
        this.raiseHandChangedHandler
      );
      this.raiseHandFeature.on("raisedHandEvent", this.raiseHandChangedHandler);
      this.capabilitiesFeature.on(
        "capabilitiesChanged",
        this.capabilitiesChangedHandler
      );
    }
  }

  updateListOfParticipantsToRender(reason) {
    const ovcFeature = this.call.feature(Features.OptimalVideoCount);
    const optimalVideoCount = ovcFeature.optimalVideoCount;
    console.log(
      `updateListOfParticipantsToRender because ${reason}, ovc is ${optimalVideoCount}`
    );
    console.log(
      `updateListOfParticipantsToRender currently rendering ${this.state.allRemoteParticipantStreams.length} streams`
    );
    console.log(
      `updateListOfParticipantsToRender checking participants that were removed`
    );
    let streamsToKeep = this.state.allRemoteParticipantStreams.filter(
      (streamTuple) => {
        return this.state.remoteParticipants.find((participant) =>
          participant.videoStreams.find(
            (stream) => stream === streamTuple.stream && stream.isAvailable
          )
        );
      }
    );

    let screenShareStream = this.state.remoteScreenShareStream;
    console.log(
      `updateListOfParticipantsToRender current screen share ${!!screenShareStream}`
    );
    screenShareStream = this.state.remoteParticipants
      .filter((participant) =>
        participant.videoStreams.find(
          (stream) =>
            stream.mediaStreamType === "ScreenSharing" && stream.isAvailable
        )
      )
      .map((participant) => {
        return {
          stream: participant.videoStreams.filter(
            (stream) => stream.mediaStreamType === "ScreenSharing"
          )[0],
          participant,
          streamRendererComponentRef: React.createRef(),
        };
      })[0];

    console.log(
      `updateListOfParticipantsToRender streams to keep=${
        streamsToKeep.length
      }, including screen share ${!!screenShareStream}`
    );

    if (streamsToKeep.length > optimalVideoCount) {
      console.log(
        "updateListOfParticipantsToRender reducing number of videos to ovc=",
        optimalVideoCount
      );
      streamsToKeep = streamsToKeep.slice(0, optimalVideoCount);
    }

    // we can add more streams if we have less than optimalVideoCount
    if (streamsToKeep.length < optimalVideoCount) {
      console.log(
        `stack is capable of rendering ${
          optimalVideoCount - streamsToKeep.length
        } more streams, adding...`
      );
      let streamsToAdd = [];
      this.state.remoteParticipants.forEach((participant) => {
        const newStreams = participant.videoStreams
          .flat()
          .filter(
            (stream) => stream.mediaStreamType === "Video" && stream.isAvailable
          )
          .filter(
            (stream) =>
              !streamsToKeep.find(
                (streamTuple) => streamTuple.stream === stream
              )
          )
          .map((stream) => {
            return {
              stream,
              participant,
              streamRendererComponentRef: React.createRef(),
            };
          });
        streamsToAdd.push(...newStreams);
      });
      streamsToAdd = streamsToAdd.slice(
        0,
        optimalVideoCount - streamsToKeep.length
      );
      console.log(
        `updateListOfParticipantsToRender identified ${streamsToAdd.length} streams to add`
      );
      streamsToKeep = streamsToKeep.concat(streamsToAdd.filter((e) => !!e));
    }
    console.log(
      `updateListOfParticipantsToRender final number of streams to render ${streamsToKeep.length}}`
    );
    this.setState((prevState) => ({
      ...prevState,
      remoteScreenShareStream: screenShareStream,
      allRemoteParticipantStreams: streamsToKeep,
    }));
  }

  spotlightStateChangedHandler = (event) => {
    this.setState({
      isSpotlighted: utils.isParticipantSpotlighted(
        this.identifier,
        this.spotlightFeature.getSpotlightedParticipants()
      ),
    });
  };

  raiseHandChangedHandler = (event) => {
    this.setState({
      isHandRaised: utils.isParticipantHandRaised(
        this.identifier,
        this.raiseHandFeature.getRaisedHands()
      ),
    });
  };

  capabilitiesChangedHandler = (capabilitiesChangeInfo) => {
    for (const [key, value] of Object.entries(
      capabilitiesChangeInfo.newValue
    )) {
      if (key === "turnVideoOn" && value.reason != "FeatureNotSupported") {
        value.isPresent
          ? this.setState({ canOnVideo: true })
          : this.setState({ canOnVideo: false });
        continue;
      }
      if (key === "unmuteMic" && value.reason != "FeatureNotSupported") {
        value.isPresent
          ? this.setState({ canUnMuteMic: true })
          : this.setState({ canUnMuteMic: false });
        continue;
      }
      if (key === "shareScreen" && value.reason != "FeatureNotSupported") {
        value.isPresent
          ? this.setState({ canShareScreen: true })
          : this.setState({ canShareScreen: false });
        continue;
      }
      if (
        key === "spotlightParticipant" &&
        value.reason != "FeatureNotSupported"
      ) {
        value.isPresent
          ? this.setState({ canSpotlight: true })
          : this.setState({ canSpotlight: false });
        continue;
      }
      if (key === "raiseHand" && value.reason != "FeatureNotSupported") {
        value.isPresent
          ? this.setState({ canRaiseHands: true })
          : this.setState({ canRaiseHands: false });
        continue;
      }
    }
  };

  async handleVideoOnOff() {
    try {
      if (!this.state.videoOn) {
        const cameras = await this.deviceManager.getCameras();
        /*const cameraDeviceInfo = cameras.find((cameraDeviceInfo) => {
          return cameraDeviceInfo.id === this.state.selectedCameraDeviceId;
        });*/
        const cameraDeviceInfo = cameras[0];
        this.localVideoStream = new LocalVideoStream(cameraDeviceInfo);
      }

      if (
        this.call.state === "None" ||
        this.call.state === "Connecting" ||
        this.call.state === "Incoming"
      ) {
        if (this.state.videoOn) {
          this.setState({ videoOn: false });
        } else {
          this.setState({ videoOn: true });
        }
        await this.watchForCallFinishConnecting();
        if (this.state.videoOn) {
          await this.call.startVideo(this.localVideoStream);
        } else {
          await this.call.stopVideo(this.localVideoStream);
        }
      } else {
        if (!this.state.videoOn) {
          await this.call.startVideo(this.localVideoStream);
        } else {
          await this.call.stopVideo(this.localVideoStream);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  async watchForCallFinishConnecting() {
    return new Promise((resolve) => {
      if (
        this.state.callState !== "None" &&
        this.state.callState !== "Connecting" &&
        this.state.callState !== "Incoming"
      ) {
        resolve();
      } else {
        this.callFinishConnectingResolve = resolve;
      }
    }).then(() => {
      this.callFinishConnectingResolve = undefined;
    });
  }

  async handleMicOnOff() {
    try {
      if (!this.call.isMuted) {
        await this.call.mute();
      } else {
        await this.call.unmute();
      }
      this.setState({ micMuted: this.call.isMuted });
    } catch (e) {
      console.error(e);
    }
  }

  render() {
    return (
      <div className="ms-Grid mt-2">
        <div className="video-grid-row">
          {(this.state.callState === "Connected" ||
            this.state.callState === "LocalHold" ||
            this.state.callState === "RemoteHold") &&
            this.state.allRemoteParticipantStreams.map((v) => (
              <StreamRenderer
                key={`${utils.getIdentifierText(v.participant.identifier)}-${
                  v.stream.mediaStreamType
                }-${v.stream.id}`}
                ref={v.streamRendererComponentRef}
                stream={v.stream}
                remoteParticipant={v.participant}
                dominantSpeakerMode={this.state.dominantSpeakerMode}
                dominantRemoteParticipant={this.state.dominantRemoteParticipant}
                call={this.call}
                showMediaStats={this.state.logMediaStats}
              />
            ))}
          {this.state.remoteScreenShareStream && (
            <StreamRenderer
              key={`${utils.getIdentifierText(
                this.state.remoteScreenShareStream.participant.identifier
              )}-${this.state.remoteScreenShareStream.stream.mediaStreamType}-${
                this.state.remoteScreenShareStream.stream.id
              }`}
              ref={
                this.state.remoteScreenShareStream.streamRendererComponentRef
              }
              stream={this.state.remoteScreenShareStream.stream}
              remoteParticipant={this.state.remoteScreenShareStream.participant}
              dominantSpeakerMode={this.state.dominantSpeakerMode}
              dominantRemoteParticipant={this.state.dominantRemoteParticipant}
              call={this.call}
              showMediaStats={this.state.logMediaStats}
            />
          )}
        </div>
        <div className="ms-Grid-row">
          <div className="text-center">
            <span
              className="in-call-button"
              title={`Turn your video ${this.state.videoOn ? "off" : "on"}`}
              variant="secondary"
              onClick={() => this.handleVideoOnOff()}
            >
              {this.state.canOnVideo && this.state.videoOn && (
                <Icon iconName="Video" />
              )}
              {(!this.state.canOnVideo || !this.state.videoOn) && (
                <Icon iconName="VideoOff" />
              )}
            </span>
            <span
              className="in-call-button"
              title={`${
                this.state.micMuted ? "Unmute" : "Mute"
              } your microphone`}
              variant="secondary"
              onClick={() => this.handleMicOnOff()}
            >
              {this.state.canUnMuteMic && !this.state.micMuted && (
                <Icon iconName="Microphone" />
              )}
              {(!this.state.canUnMuteMic || this.state.micMuted) && (
                <Icon iconName="MicOff2" />
              )}
            </span>
            <span className="in-call-button" onClick={() => this.call.hangUp()}>
              <Icon iconName="DeclineCall" />
            </span>
          </div>
        </div>
        {this.state.videoOn && this.state.canOnVideo && (
          <div className="mt-5">
            <div className="ms-Grid-row">
              <h3>Local video preview</h3>
            </div>
            <div className="ms-Grid-row">
              <div className="ms-Grid-col ms-sm12 ms-md4 ms-lg4">
                <LocalVideoPreviewCard stream={this.localVideoStream} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}
