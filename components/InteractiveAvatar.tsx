import {
  AvatarQuality,
  StreamingEvents,
  VoiceChatTransport,
  StartAvatarRequest,
} from "@heygen/streaming-avatar";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";
import { Button } from "./Button";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { StreamingAvatarProvider, StreamingAvatarSessionState } from "./logic";

// --- CONFIGURAZIONE ANGELA (UFFICIALE) ---
// Questo ID appartiene ad "Angela-in-T-shirt", l'avatar di default per i test
const AVATAR_ID_ANGELA = "35b3e6e580e0473a870d075253896504";

const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.Low,
  avatarName: AVATAR_ID_ANGELA, 
  voiceChatTransport: VoiceChatTransport.WEBSOCKET,
  // Nessuna voce, nessuna lingua: lasciamo i default
};

function InteractiveAvatar() {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } = 
    useStreamingAvatarSession();

  const mediaStream = useRef<HTMLVideoElement>(null);
  const [debug, setDebug] = useState("Pronto.");

  // Funzione Token
  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", { method: "POST" });
      const token = await response.text();
      return token;
    } catch (error) {
      console.error("Error fetching token:", error);
      return "";
    }
  }

  const startSessionV2 = useMemoizedFn(async () => {
    try {
      setDebug("1. Richiedo Token...");
      const newToken = await fetchAccessToken();
      
      if (!newToken || newToken.length < 10) {
        setDebug("ERRORE: Token non valido o vuoto.");
        return;
      }

      setDebug("2. Token OK. Creo Sessione...");
      const newAvatar = await initAvatar(newToken); 

      // --- EVENTI ---
      newAvatar.on(StreamingEvents.STREAM_READY, () => {
        setDebug(">>> STREAM PRONTO! <<<");
      });

      newAvatar.on(StreamingEvents.USER_END_MESSAGE, async (event) => {
        console.log(">>>>> Utente:", event.detail.message);
      });
      
      setDebug("3. Avvio Avatar Angela...");
      
      // TENTATIVO DI AVVIO
      await startAvatar(DEFAULT_CONFIG);

      setDebug("4. Avvio Microfono...");
      await newAvatar.startVoiceChat(); 
      
      setDebug("Tutto attivo! Angela ti ascolta.");

    } catch (error: any) {
      console.error("Error starting session:", error);
      
      // Diagnostica dell'errore 400
      if (error.message && error.message.includes("400")) {
        setDebug("ERRORE 400: Probabilmente CREDITI ESAURITI su HeyGen.");
      } else {
        setDebug("ERRORE: " + error.message);
      }
    }
  });

  useUnmount(() => {
    stopAvatar();
  });

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
      };
    }
  }, [mediaStream, stream]);

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex flex-col rounded-xl bg-zinc-900 overflow-hidden">
        <div className="relative w-full aspect-video overflow-hidden flex flex-col items-center justify-center">
          {sessionState !== StreamingAvatarSessionState.INACTIVE ? (
            <AvatarVideo ref={mediaStream} />
          ) : (
            <div className="p-10 text-white text-center">
              <h2 className="text-2xl font-bold mb-2">Totem Villaggio</h2>
              <p>Test Finale con Angela</p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 items-center justify-center p-4 border-t border-zinc-700 w-full bg-black">
          {sessionState === StreamingAvatarSessionState.INACTIVE ? (
            <Button onClick={startSessionV2} className="bg-green-600 text-white px-8 py-4 rounded-xl text-xl font-bold">
              AVVIA ANGELA
            </Button>
          ) : (
             <div className="text-white text-center w-full">
                <p className="text-xs text-yellow-400 mb-4 font-mono font-bold">{debug}</p>
                <Button onClick={() => stopAvatar()} className="bg-red-600 px-4 py-2 rounded text-white">
                  Termina
                </Button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InteractiveAvatarWrapper() {
  return (
    <StreamingAvatarProvider basePath={process.env.NEXT_PUBLIC_BASE_API_URL}>
      <InteractiveAvatar />
    </StreamingAvatarProvider>
  );
}
