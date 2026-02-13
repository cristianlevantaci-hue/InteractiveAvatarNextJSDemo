import {
  AvatarQuality,
  StreamingEvents,
  VoiceChatTransport,
  VoiceEmotion,
  StartAvatarRequest,
  STTProvider,
  TaskType,
} from "@heygen/streaming-avatar";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";
import { Button } from "./Button";
import { AvatarConfig } from "./AvatarConfig";
import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { AvatarControls } from "./AvatarSession/AvatarControls";
import { StreamingAvatarProvider, StreamingAvatarSessionState } from "./logic";
import { LoadingIcon } from "./Icons";
import { MessageHistory } from "./AvatarSession/MessageHistory";

// --- CONFIGURAZIONE ---
const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.Low, // Manteniamo Low per velocità
  avatarName: "ef08039a41354ed5a20565db899373f3", // Usiamo Monika (Standard) per il test
  // knowledgeId: undefined, // RIMOSSO: A volte crea conflitti se undefined
  // voice: { ... } // RIMOSSO: Le emozioni causano spesso errore 400
  // language: "it", // RIMOSSO: Proviamo prima in Inglese per vedere se parte
};

function InteractiveAvatar() {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } = 
    useStreamingAvatarSession();

  const [config, setConfig] = useState<StartAvatarRequest>(DEFAULT_CONFIG);
  const mediaStream = useRef<HTMLVideoElement>(null);
  const [isTalking, setIsTalking] = useState(false);
  const [debug, setDebug] = useState("Pronto.");

  // --- TOKEN ---
  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", { method: "POST" });
      return await response.text();
    } catch (error) {
      console.error("Error fetching token:", error);
      return "";
    }
  }

  // --- AVVIO SESSIONE ---
  const startSessionV2 = useMemoizedFn(async () => {
    try {
      setDebug("Richiedo Token...");
      const newToken = await fetchAccessToken();
      
      setDebug("Creo Avatar...");
      const newAvatar = await initAvatar(newToken); 

      // --- EVENTI ---
      newAvatar.on(StreamingEvents.USER_END_MESSAGE, async (event) => {
        const userText = event.detail.message;
        console.log(">>>>> Utente ha detto:", userText);
        setDebug("Utente: " + userText);

        if (!userText) return;

        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: userText })
          });
          
          const botReply = await response.text();
          console.log(">>>>> Voiceflow risponde:", botReply);
          setDebug("Risposta: " + botReply);

          if (botReply) {
             await newAvatar.speak({ 
                text: botReply, 
                task_type: TaskType.REPEAT 
             });
          }
        } catch (e) {
          console.error("Errore Voiceflow:", e);
          setDebug("Errore connessione AI");
        }
      });

      newAvatar.on(StreamingEvents.AVATAR_START_TALKING, () => setIsTalking(true));
      newAvatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => setIsTalking(false));
      
      // --- START ---
      setDebug("Avvio Video...");
      await startAvatar({
          ...config,
          avatarName: "19deca1e52b6457d82412bd5fd5216c3", 
      });

      setDebug("Avvio Microfono...");
      // CORREZIONE QUI: Ho rimosso l'argomento che dava errore.
      // Ora chiamiamo la funzione vuota, che accende il microfono di default.
      await newAvatar.startVoiceChat(); 
      
      setDebug("Parla pure!");

    } catch (error) {
      console.error("Error starting session:", error);
      setDebug("Errore Avvio: " + error);
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
              <p>Clicca Avvia per parlare</p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 items-center justify-center p-4 border-t border-zinc-700 w-full bg-black">
          {sessionState === StreamingAvatarSessionState.INACTIVE ? (
            <Button onClick={startSessionV2} className="bg-blue-600 text-white px-8 py-4 rounded-xl text-xl font-bold">
              AVVIA TOTEM
            </Button>
          ) : (
             <div className="text-white text-center w-full">
                <p className="text-yellow-400 font-mono text-lg mb-2">
                    {isTalking ? "🔊 Sto parlando..." : "👂 Ti ascolto..."}
                </p>
                <p className="text-xs text-gray-500 mb-4">{debug}</p>
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
