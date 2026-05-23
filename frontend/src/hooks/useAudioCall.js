import { useEffect, useRef, useState, useCallback  } from 'react';
import socket from '../socket';

const peerConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

export function useAudioCall(currentUserId) {
  const [incomingCall, setIncomingCall] = useState(null);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [callUserId, setCallUserId] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localVideoRef = useRef(null);
const remoteVideoRef = useRef(null);
  const timerRef = useRef(null);

  const createPeer = (targetUserId) => {
    const peer = new RTCPeerConnection(peerConfig);

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('iceCandidate', {
          to: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    peer.ontrack = (event) => {
        if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        }

        if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        }
    };

    peerRef.current = peer;
    return peer;
  };

const getLocalMedia = async (withVideo = false) => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: withVideo,
  });

  localStreamRef.current = stream;

  setTimeout(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  }, 0);

  return stream;
};

    const startCall = async (
    targetUserId,
    withVideo = false
    ) => {
  const stream = await getLocalMedia(withVideo);
    const peer = createPeer(targetUserId);

    stream.getTracks().forEach((track) => {
      peer.addTrack(track, stream);
    });

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    setCallUserId(targetUserId);
    setIsCalling(true);
    setIsVideoCall(withVideo);
    setCallStatus('Calling...');

    socket.emit('callUser', {
      to: targetUserId,
      from: currentUserId,
      offer,
      withVideo,
    });
  };

  const acceptCall = async () => {
  if (!incomingCall) return;

  setIsVideoCall(Boolean(incomingCall.withVideo));
  setIsInCall(true);
  setCallUserId(incomingCall.from);
  setCallStatus('In call');

  const stream = await getLocalMedia(incomingCall.withVideo);
  const peer = createPeer(incomingCall.from);

  stream.getTracks().forEach((track) => {
    peer.addTrack(track, stream);
  });

  await peer.setRemoteDescription(
    new RTCSessionDescription(incomingCall.offer)
  );

  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);

  socket.emit('answerCall', {
    to: incomingCall.from,
    answer,
  });

  setIncomingCall(null);

  timerRef.current = setInterval(() => {
    setCallDuration((prev) => prev + 1);
  }, 1000);
};

  const rejectCall = () => {
    if (incomingCall) {
      socket.emit('endCall', {
        to: incomingCall.from,
      });
    }

    setIncomingCall(null);
  };

  const endCall = () => {
    if (callUserId) {
      socket.emit('endCall', {
        to: callUserId,
      });
    }

    cleanupCall();
    setIsVideoCall(false);
  };

  const toggleMute = () => {
  if (!localStreamRef.current) return;

  const audioTrack =
    localStreamRef.current.getAudioTracks()[0];

  if (!audioTrack) return;

  audioTrack.enabled = !audioTrack.enabled;

  setIsMuted(!audioTrack.enabled);
};

  const cleanupCall = () => {
    peerRef.current?.close();
    peerRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    localStreamRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
        }

        if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
        }
    clearInterval(timerRef.current);

    setCallStatus('Call ended');

    setTimeout(() => {
    setCallStatus('');
    }, 2000);

    setCallDuration(0);

    setIncomingCall(null);
    setCallUserId(null);
    setIsCalling(false);
    setIsInCall(false);
    setIsMuted(false);
  };

  useEffect(() => {
    const handleIncomingCall = ({
        from,
        offer,
        withVideo,
        }) => {
      setCallStatus('Ringing...');
    setIncomingCall({
        from,
        offer,
        withVideo,
        });
    };

    const handleCallAnswered = async ({ answer }) => {
      if (!peerRef.current) return;

      await peerRef.current.setRemoteDescription(
        new RTCSessionDescription(answer)
      );

      setIsCalling(false);
      setIsInCall(true);
      setCallStatus('In call');

        timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
        }, 1000);
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (!peerRef.current || !candidate) return;

      await peerRef.current.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    };

    const handleCallEnded = () => {
      cleanupCall();
    };

    socket.on('incomingCall', handleIncomingCall);
    socket.on('callAnswered', handleCallAnswered);
    socket.on('iceCandidate', handleIceCandidate);
    socket.on('callEnded', handleCallEnded);

    return () => {
      socket.off('incomingCall', handleIncomingCall);
      socket.off('callAnswered', handleCallAnswered);
      socket.off('iceCandidate', handleIceCandidate);
      socket.off('callEnded', handleCallEnded);
    };
  }, []);

const attachVideoStreams = useCallback(() => {
  if (localVideoRef.current && localStreamRef.current) {
    localVideoRef.current.srcObject = localStreamRef.current;
  }

  if (
    remoteVideoRef.current &&
    remoteAudioRef.current?.srcObject
  ) {
    remoteVideoRef.current.srcObject = remoteAudioRef.current.srcObject;
  }
}, []);

  return {
    incomingCall,
    isCalling,
    isInCall,
    remoteAudioRef,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    callStatus,
    callDuration,
    isMuted,
    toggleMute,
    attachVideoStreams,
    isVideoCall,
  };
}