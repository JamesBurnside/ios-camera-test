import React, { useCallback, useEffect } from "react";

import {
  Call,
  CallClient,
  LocalVideoStream,
  VideoStreamRenderer,
} from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from "@azure/communication-common";
import { AzureLogger, setLogLevel } from "@azure/logger";

// Set the logger's log level
setLogLevel("verbose");

// Redirect log output to wherever desired. To console, file, buffer, REST API, etc...
AzureLogger.log = (...args: any[]) => {
  console.log(...args); // Redirect log output to console
};

const USER_TOKEN: string = "REPLACE ME WITH A USER TOKEN";

if (USER_TOKEN === "REPLACE ME WITH A USER TOKEN") {
  alert("You must provide a user token in the App.tsx to run this sample.");
}

const GROUP_ID = "9864d700-9a0a-11ee-9b69-f7629c09a40f";

const callClient = new CallClient();

const initializeCall = async (): Promise<Call> => {
  const tokenCredential = new AzureCommunicationTokenCredential(USER_TOKEN);
  const callAgent = await callClient.createCallAgent(tokenCredential, {
    displayName: "Test User",
  });
  return callAgent.join({ groupId: GROUP_ID });
};

const turnOnCamera = async (call: Call): Promise<void> => {
  const deviceManager = await callClient.getDeviceManager();
  const cameras = await deviceManager.getCameras();
  const camera = cameras[0];
  const localVideoStream = new LocalVideoStream(camera);
  await call.startVideo(localVideoStream);
};

function App() {
  // immediately start a call
  const [call, setCall] = React.useState<Call>();
  useEffect(() => {
    initializeCall().then((call) => {
      setCall(call);
    });
  }, []);

  const [callState, setCallState] = React.useState<Call["state"] | 'Joining call...'>("Joining call...");
  const inACall = callState === "Connected" || callState === "LocalHold";
  const isOnHold = callState === 'LocalHold';
  useEffect(() => {
    const stateChangedHandler = () => {
      setCallState(call?.state ?? "None");
    };
    call?.on("stateChanged", stateChangedHandler);
    return () => {
      call?.off("stateChanged", stateChangedHandler);
    };
  }, [call]);

  const videoDivRef = React.useRef<HTMLDivElement>(null);

  const [localVideoStream, setLocalVideoStream] =
    React.useState<LocalVideoStream>();
  useEffect(() => {
    const localVideoStreamChanged = ({
      added,
      removed,
    }: {
      added: LocalVideoStream[];
      removed: LocalVideoStream[];
    }) => {
      if (added.length > 0) {
        setLocalVideoStream(added[0]);
      }
      if (removed.length > 0) {
        setLocalVideoStream(undefined);
      }
    };
    call?.on("localVideoStreamsUpdated", localVideoStreamChanged);
    return () => {
      call?.off("localVideoStreamsUpdated", localVideoStreamChanged);
    };
  }, [call]);

  const [videoStreamRenderer, setVideoStreamRenderer] =
    React.useState<VideoStreamRenderer>();

  const [cameraToggleState, setCameraToggleState] =
    React.useState<"on" | "off">("off");

  const cutVideoFeed = useCallback(() => {
    videoStreamRenderer?.dispose();
    setVideoStreamRenderer(undefined);
  }, [videoStreamRenderer]);

  useEffect(() => {
    if (localVideoStream && videoDivRef.current && callState === "Connected" && !videoStreamRenderer && cameraToggleState === "on") {
      const videoStreamRenderer = new VideoStreamRenderer(localVideoStream);
      videoStreamRenderer.createView({ scalingMode: "Crop" }).then((view) => {
        videoDivRef.current?.appendChild(view.target);
      });
      setVideoStreamRenderer(videoStreamRenderer);
    }
    // Destroy video when on hold
    else if (
      videoStreamRenderer &&
      isOnHold
    ) {
      cutVideoFeed();
    }
  }, [videoStreamRenderer, cutVideoFeed, callState, isOnHold, localVideoStream, cameraToggleState]);

  return (
    <div>
      <div>Call state: {callState}</div>
      <button
        disabled={!inACall}
        onClick={() => {
          if (call) {
            isOnHold ? call.resume() : call.hold();
          }
        }}
      >
        {isOnHold ? 'Resume' : 'Hold'}
      </button>
      <button
        disabled={!inACall}
        onClick={() => {
          call?.hangUp();
        }}
      >
        End Call
      </button>
      <br />
      <div>Call.camera: {videoStreamRenderer ? "on" : "off"}</div>
      <button
        disabled={!inACall}
        onClick={() => {
          call && setCameraToggleState((state) => {
            if (state === "on") {
              cutVideoFeed();
              localVideoStream && call.stopVideo(localVideoStream);
              return "off";
            } else {
              turnOnCamera(call);
              return "on";
            }
          });
        }}
      >
        {`Turn camera ${cameraToggleState === "on" ? "off" : "on"}`} 
      </button>
      <br />
      <div ref={videoDivRef}></div>
    </div>
  );
}

export default App;
