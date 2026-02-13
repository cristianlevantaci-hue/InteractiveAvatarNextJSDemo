// VERSIONE NUOVA - RIGENERATA DA ZERO
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

// --- TUE CONFIGURAZIONI ---
const YOUR_AVATAR_ID = "19deca1e52b6457d82412bd5fd5216c3"; 

const DEFAULT_CONFIG: StartAvatarRequest = {
  quality: AvatarQuality.High,
  avatarName: YOUR_AVATAR_ID, 
  knowledgeId: undefined, 
  voice: {
    rate: 1.0, 
    emotion: VoiceEmotion.FRIENDLY, 
  },
  language: "it", 
  voiceChatTransport: VoiceChatTransport.WEBSOCKET,
  sttSettings: {
    provider: STTProvider.DEEPGRAM,
  },
};

function InteractiveAvatar() {
  // RIGA CRITICA: Qui sotto NON c'è 'avatar'. Se lo vedi, cancellalo.
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } = 
    useStreamingAvatarSession();

  const [config, setConfig] = useState<StartAvatarRequest>(DEFAULT_CONFIG);
  const mediaStream = useRef<HTMLVideoElement>(null);
  const [isTalking, setIsTalking] = useState(false);
  const [debugMsg, setDebugMsg] = useState("");

  // --- TOKEN ---
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

  // --- AVVIO SESSIONE ---
  const startSessionV2 = useMemoizedFn(async () => {
    try {
      setDebugMsg("Richiesta token...");
      const newToken = await fetchAccessToken();
      if (!newToken) {
        setDebugMsg("Errore: Token non ricevuto");
        return;
      }

      setDebugMsg("Inizializzazione Avatar...");
      const newAvatar = await initAvatar(newToken); 

      // --- EVENTI ---
      newAvatar.on(StreamingEvents.USER_END_MESSAGE, async (event) => {
        const userText = event.detail.message;
        console.log(">>>>> Utente ha detto:", userText);
        setDebugMsg("Utente: " + userText);

        if (!userText) return;

        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: userText })
          });
          
          const botReply = await response.text();
          console.log(">>>>> Voiceflow risponde:", botReply);
          setDebugMsg("VF risponde: " + botReply);

          if (botReply) {
             await newAvatar.speak({ 
                text: botReply, 
                task_type: TaskType.REPEAT 
             });
          }
        } catch (e) {
          console.error("Errore comunicazione Voiceflow:", e);
          setDebugMsg("Errore Voiceflow");
        }
      });

      newAvatar.on(StreamingEvents.AVATAR_START_TALKING, () => setIsTalking(true));
      newAvatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => setIsTalking(false));
      newAvatar.on(StreamingEvents.STREAM_READY, () => setDebugMsg("Stream Pronto!"));
      
      // --- START ---
      setDebugMsg("Avvio Video...");
      await startAvatar({
          ...config,
          avatarName: YOUR_AVATAR_ID, 
      });

      setDebugMsg("Avvio Microfono...");
      await newAvatar.startVoiceChat({ useSilencePrompt: false });

    } catch (error) {
      console.error("Error starting session:", error);
      setDebugMsg("Errore avvio sessione");
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
            <div className="p-10 text-white text-center flex flex-col gap-4">
              <h2 className="text-2xl font-bold">Totem Villaggio</h2>
              <p>Clicca il pulsante blu per iniziare</p>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-3 items-center justify-center p-4 border-t border-zinc-700 w-full bg-black">
          {sessionState === StreamingAvatarSessionState.INACTIVE ? (
            <Button 
              onClick={startSessionV2} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-xl rounded-full font-bold shadow-lg transition-all"
            >
              AVVIA TOTEM
            </Button>
          ) : (
             <div className="text-white text-center w-full">
                <p className="mb-2 text-lg font-mono text-yellow-400">
                  {isTalking ? "🔊 Sto parlando..." : "👂 Ti ascolto..."}
                </p>
                <p className="text-xs text-gray-500 mb-4">{debugMsg}</p>
                
                <Button onClick={() => stopAvatar()} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg">
                  Termina Sessione
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
