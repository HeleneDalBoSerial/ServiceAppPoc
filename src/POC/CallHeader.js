import React, { useState } from "react";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";
import { ContosoCallContainer } from "./ContosoCallContainer";
import CallCard from "./CallCard";
import { PrimaryButton } from "office-ui-fabric-react";
import { useSelector } from "react-redux";
import { LocalVideoStream } from "@azure/communication-calling";
import { Persona, PersonaSize } from "@fluentui/react/lib/Persona";
import {
  CallComposite,
  useAzureCommunicationCallAdapter,
} from "@azure/communication-react";
//import { setInCall } from "../store/pocSlice";

function CallHeader() {
  const loggedIn = useSelector((state) => state.poc.loggedIn);
  //const inCall = useSelector((state) => state.poc.inCall);
  const userId = useSelector((state) => state.poc.communicationUserId);
  const token = useSelector((state) => state.poc.token);
  const displayName = useSelector((state) => state.poc.displayName);
  const deviceManager = useSelector((state) => state.poc.deviceManager);
  const callAgent = useSelector((state) => state.poc.callAgent);
  const call = useSelector((state) => state.poc.call);
  const identityMri = useSelector((state) => state.poc.identityMri);
  const projectData = useSelector((state) => state.poc.projectData);

  const [permissions, setPermissions] = useState(null);
  const [adapter, setAdapter] = useState(null);
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = useState(null);
  const [speakerDeviceOptions, setSpeakerDeviceOptions] = useState(null);
  const [cameraDeviceOptions, setCameraDeviceOptions] = useState(null);
  const [selectedMicrophoneDeviceId, setSelectedMicrophoneDeviceId] =
    useState(null);
  const [microphoneDeviceOptions, setMicrophoneDeviceOptions] = useState(null);
  const [selectedSpeakerDeviceId] = useState(null);
  const [deviceManagerWarning, setDeviceManagerWarning] = useState(null);
  const [roomId] = useState("99537831320953925");
  const [options] = useState({
    localVideoTileOptions: { position: "floating" },
  });
  const [showCallComposite, setShowCallComposite] = useState(false);
  const [hideCallModal, setHideCallModal] = useState(false);
  const [inCall, setInCall] = useState(false);

  async function getCallOptions(options) {
    let callOptions = {
      videoOptions: {
        localVideoStreams: undefined,
      },
      audioOptions: {
        muted: !!options.micMuted,
      },
    };

    let cameraWarning = undefined;
    let speakerWarning = undefined;
    let microphoneWarning = undefined;

    // On iOS, device permissions are lost after a little while, so re-ask for permissions
    const permissions = await deviceManager.askDevicePermission({
      audio: true,
      video: true,
    });
    setPermissions(permissions);

    const cameras = await deviceManager.getCameras();
    const cameraDevice = cameras[0];
    if (cameraDevice && cameraDevice?.id !== "camera:") {
      setSelectedCameraDeviceId(cameraDevice?.id);
      setCameraDeviceOptions(
        cameras.map((camera) => {
          return { key: camera.id, text: camera.name };
        })
      );
    }
    if (options.video) {
      try {
        if (!cameraDevice || cameraDevice?.id === "camera:") {
          throw new Error("No camera devices found.");
        } else if (cameraDevice) {
          callOptions.videoOptions = {
            localVideoStreams: [new LocalVideoStream(cameraDevice)],
          };
        }
      } catch (e) {
        cameraWarning = e.message;
      }
    }

    try {
      const speakers = await deviceManager.getSpeakers();
      const speakerDevice = speakers[0];
      if (!speakerDevice || speakerDevice.id === "speaker:") {
        throw new Error("No speaker devices found.");
      } else if (speakerDevice) {
        setSelectedCameraDeviceId(speakerDevice.id);
        setSpeakerDeviceOptions(
          speakers.map((speaker) => {
            return { key: speaker.id, text: speaker.name };
          })
        );

        await deviceManager.selectSpeaker(speakerDevice);
      }
    } catch (e) {
      speakerWarning = e.message;
    }

    try {
      const microphones = await deviceManager.getMicrophones();
      const microphoneDevice = microphones[0];
      if (!microphoneDevice || microphoneDevice.id === "microphone:") {
        throw new Error("No microphone devices found.");
      } else {
        setSelectedMicrophoneDeviceId(microphoneDevice.id);
        setMicrophoneDeviceOptions(
          microphones.map((microphone) => {
            return { key: microphone.id, text: microphone.name };
          })
        );

        await deviceManager.selectMicrophone(microphoneDevice);
      }
    } catch (e) {
      microphoneWarning = e.message;
    }

    if (cameraWarning || speakerWarning || microphoneWarning) {
      setDeviceManagerWarning(`${cameraWarning ? cameraWarning + " " : ""}
        ${speakerWarning ? speakerWarning + " " : ""}
        ${microphoneWarning ? microphoneWarning + " " : ""}`);
    }

    return callOptions;
  }

  async function joinRooms(withVideo) {
    setInCall(true);
    try {
      const callOptions = await getCallOptions({
        video: withVideo,
        micMuted: false,
      });
      callAgent.join({ roomId }, callOptions);
    } catch (e) {
      console.error("Failed to join a call", e);
      setInCall(false);
    }
  }

  const leaveCall = async (adapter) => {
    await adapter.leaveCall().catch((e) => {
      console.error("Failed to leave call", e);
    });
  };

  const leaveCallEvent = () => {
    setInCall(false);
  };

  const goBackFromCall = async () => {
    setHideCallModal(true);
  };

  const backToCall = async () => {
    setHideCallModal(false);
  };

  React.useEffect(() => {
    if (showCallComposite) {
      if (!adapter) {
        initCallAdapter();
      }
      setInCall(true);
    }
  }, [showCallComposite]);

  function initCallAdapter() {
    try {
      const credential = new AzureCommunicationTokenCredential(token);

      const adapter = useAzureCommunicationCallAdapter(
        {
          userId: userId,
          displayName: displayName, // Max 256 Characters
          credential,
          locator: roomId
            ? {
                roomId: roomId,
              }
            : undefined,
        },
        undefined,
        leaveCall
      );
      setAdapter(adapter);
    } catch (e) {
      console.error("Failed to join a call", e);
      setInCall(false);
      setShowCallComposite(false);
    }
  }

  function joinCall() {
    if (!adapter) {
      initCallAdapter();
    }
    setInCall(true);
    setShowCallComposite(true);
  }

  return (
    <header
      className="header callheader"
      style={{
        maxHeight: hideCallModal ? "50px" : "auto",
      }}
    >
      <div className="call_header_content">
        <PrimaryButton
          className="primary-button"
          style={{
            visibility: inCall && !hideCallModal ? "visible" : "hidden",
          }}
          iconProps={{
            iconName: "Back",
            style: { verticalAlign: "middle", fontSize: "large" },
          }}
          onClick={() => goBackFromCall()}
        ></PrimaryButton>
        <Persona {...projectData} size={PersonaSize.size56} />
        {!inCall && (
          <>
            <PrimaryButton
              className="primary-button"
              iconProps={{
                iconName: "Video",
                style: { verticalAlign: "middle", fontSize: "large" },
              }}
              disabled={inCall || !loggedIn}
              onClick={() => joinRooms(true)}
            ></PrimaryButton>
            <PrimaryButton
              className="primary-button"
              iconProps={{
                iconName: "Phone",
                style: { verticalAlign: "middle", fontSize: "large" },
              }}
              disabled={inCall || !loggedIn}
              onClick={() => joinRooms(false)}
            ></PrimaryButton>
          </>
        )}

        {inCall && hideCallModal && (
          <>
            <PrimaryButton
              className="primary-button decline-call-button "
              iconProps={{
                iconName: "DeclineCall",
                style: { verticalAlign: "middle", fontSize: "large" },
              }}
              onClick={() => leaveCallEvent()}
            ></PrimaryButton>
            <PrimaryButton
              className="primary-button"
              iconProps={{
                iconName: "FullScreen",
                style: { verticalAlign: "middle", fontSize: "large" },
              }}
              onClick={() => backToCall()}
            ></PrimaryButton>
          </>
        )}
      </div>
      {/*showCallComposite && (
        <ContosoCallContainer
          token={token}
          userId={userId}
          displayName={displayName}
          roomId={roomId}
        />
      )*/}
      {call && inCall && (
        <CallCard
          call={call}
          deviceManager={deviceManager}
          selectedCameraDeviceId={selectedCameraDeviceId}
          cameraDeviceOptions={cameraDeviceOptions}
          speakerDeviceOptions={speakerDeviceOptions}
          microphoneDeviceOptions={microphoneDeviceOptions}
          identityMri={identityMri}
          isTeamsUser={false}
          hide={hideCallModal}
          leaveCall={leaveCallEvent}
          onShowCameraNotFoundWarning={(show) => {
            this.setState({ showCameraNotFoundWarning: show });
          }}
          onShowSpeakerNotFoundWarning={(show) => {
            this.setState({ showSpeakerNotFoundWarning: show });
          }}
          onShowMicrophoneNotFoundWarning={(show) => {
            this.setState({ showMicrophoneNotFoundWarning: show });
          }}
        />
      )}
    </header>
  );
}

export default CallHeader;
