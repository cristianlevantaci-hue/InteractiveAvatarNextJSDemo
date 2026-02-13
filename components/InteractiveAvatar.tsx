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

// --- CONFIGURAZIONE MINIMALE ---
// Usiamo "Silas" che funziona su tutti i piani, senza impostazioni complesse
const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.Low,
  avatarName: "2c54f98a1a3641778947b19888916298", // ID di Silas (Standard)
  voiceChatTransport: VoiceChatTransport.WEBSOCKET,
  // Rimosso STT (Deepgram), Rimosso Language, Rimosso Emotion
};

function InteractiveAvatar() {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } = 
    useStreamingAvatarSession();

  const mediaStream = useRef<HTMLVideoElement>(null);
  const [debug, setDebug] = useState("Pronto.");

  // Funzione per prendere il token
  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", { method: "POST" });
      const token = await response.text();
      // Controllo di sicurezza: se il token è un errore, lo mostriamo
      if (token.includes("Error") || token.includes("error")) {
        throw new Error("Token non valido: " + token);
      }
      return token;
    } catch (error) {
      console.error("Error fetching token:", error);
      setDebug("Errore Token: " + error);
      return "";
    }
  }

  const startSessionV2 = useMemoizedFn(async () => {
    try {
      setDebug("Richiedo Token...");
      const newToken = await fetchAccessToken();
      
      if (!newToken) return; // Ci fermiamo se non c'è il token

      setDebug("Creo Avatar...");
      const newAvatar = await initAvatar(newToken); 

      // --- EVENTI ---
      newAvatar.on(StreamingEvents.STREAM_READY, () => {
        setDebug("Stream Pronto! (Parla ora)");
      });

      newAvatar.on(StreamingEvents.USER_END_MESSAGE, async (event) => {
        console.log(">>>>> Utente:", event.detail.message);
        // Qui ci andrà Voiceflow dopo, prima testiamo se parte
      });
      
      setDebug("Avvio Video...");
      // Avviamo SENZA configurazioni extra
      await startAvatar(DEFAULT_CONFIG);

      setDebug("Avvio Microfono...");
      await newAvatar.startVoiceChat(); 
      
      setDebug("Tutto attivo! Parla.");

    } catch (error) {
      console.error("Error starting session:", error);
      // Mostriamo l'errore completo a schermo
      setDebug("Errore Start: " + (error as any).message); 
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
              <p>Clicca Avvia per testare</p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 items-center justify-center p-4 border-t border-zinc-700 w-full bg-black">
          {sessionState === StreamingAvatarSessionState.INACTIVE ? (
            <Button onClick={startSessionV2} className="bg-blue-600 text-white px-8 py-4 rounded-xl text-xl font-bold">
              AVVIA TEST SILAS
            </Button>
          ) : (
             <div className="text-white text-center w-full">
                <p className="text-xs text-gray-400 mb-4 font-mono">{debug}</p>
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
