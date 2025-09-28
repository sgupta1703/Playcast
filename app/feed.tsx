import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
  Easing,
  PanResponder,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ResizeMode, Video } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Star, Settings, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthContext } from "./auth/AuthProvider";
import { useIsFocused } from "@react-navigation/native";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase"; 

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Highlight = {
  id: string;
  videoUrl?: string;
  caption?: string;
  game?: string;
  score?: string;
  sport?: string;
  infoRaw?: any;
  isEndMessage?: boolean;
};

const WRAP_MARGIN = 6;
const BORDER_WIDTH = 0.4;
const VIDEO_SCALE = 0.985;
const LONG_PRESS_MS = 200;
const MUTE_ACCEPT_DELAY_MS = 70;


function StarRating({
  rating,
  onChange,
}: {
  rating: number;
  onChange: (r: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      <Text style={styles.rateLabel}>Rate this play:</Text>

      <View style={{ flexDirection: "row", marginLeft: 8 }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Pressable key={s} onPress={() => onChange(s)} style={{ marginHorizontal: 4 }}>
            <Star size={20} fill={s <= rating ? "#FFD700" : "transparent"} color={s <= rating ? "#FFD700" : "rgba(255,255,255,0.35)"} />
          </Pressable>
        ))}
      </View>

      {rating > 0 && <Text style={styles.ratingText}>{rating}/5</Text>}
    </View>
  );
}


function VideoItem({
  item,
  isActive,
  isMuted,
  onToggleMute,
  onHoldStart,
  onHoldEnd,
  safeTop,
  onOpenDetails, 
}: {
  item: Highlight;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  safeTop: number;
  onOpenDetails: (info: any) => void;
}) {
  const videoRef = useRef<Video | null>(null);
  const [rating, setRating] = useState<number>(0);
  const { user } = useAuthContext(); 


  const saveRatingToFirestore = async (uid: string, playId: string, value: number) => {
    try {
      const ref = doc(db, "user_ratings", uid, "ratings", playId);
      await setDoc(
        ref,
        {
          rating: value,
          updatedAt: serverTimestamp(),
          playId,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("Failed to save rating:", err);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (!user?.uid) return;
    (async () => {
      try {
        const ref = doc(db, "user_ratings", user.uid, "ratings", item.id);
        const snap = await getDoc(ref);
        if (!mounted) return;
        if (snap.exists()) {
          const data = snap.data() as any;
          if (typeof data?.rating === "number") {
            setRating(data.rating);
          }
        }
      } catch (err) {
        console.warn("Failed to load rating:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [item.id, user?.uid]);

  const handleRatingChange = (r: number) => {
    setRating(r); 
    if (user?.uid) {
      saveRatingToFirestore(user.uid, item.id, r);
    } else {
      console.warn("Not signed in — rating not persisted to server.");
    }
  };

  useEffect(() => {
    const ref = videoRef.current;
    if (!ref) return;
    let mounted = true;
    (async () => {
      try {
        if (isActive) {
          await ref.playAsync();
        } else {
          await ref.pauseAsync();
        }
      } catch {
        if (!mounted) return;
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isActive]);

  const longPressDetectedRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);

  const handlePressIn = () => {
    longPressDetectedRef.current = false;
    holdTimerRef.current = (window.setTimeout(() => {
      longPressDetectedRef.current = true;
      onHoldStart();
    }, LONG_PRESS_MS) as unknown) as number;
  };

  const handlePressOut = () => {
    if (holdTimerRef.current != null) {
      clearTimeout(holdTimerRef.current as number);
      holdTimerRef.current = null;
    }
    if (longPressDetectedRef.current) {
      longPressDetectedRef.current = false;
      onHoldEnd();
    } else {
      onToggleMute();
    }
  };

  const panX = useRef(new Animated.Value(0)).current;

  const THRESHOLD = 50;
const panResponder = useRef(
  PanResponder.create({
    onStartShouldSetPanResponder: (_evt, _gesture) => false,

    onMoveShouldSetPanResponder: (_evt, gesture) => {
      const absDx = Math.abs(gesture.dx);
      const absDy = Math.abs(gesture.dy);
      const startX = (gesture.x0 ?? gesture.moveX ?? SCREEN_WIDTH / 2);
      const startedFromRight = startX > SCREEN_WIDTH * 0.6; 

      return (
        absDx > 4 && 
        (
          absDx > absDy * 1.05 ||          
          Math.abs(gesture.vx) > 0.35 ||    
          (startedFromRight && absDx > 3)  
        )
      );
    },

    onPanResponderGrant: () => {
      panX.setValue(0);
    },

    onPanResponderMove: (_evt, gesture) => {
      const clampedDx = Math.max(-350, Math.min(350, gesture.dx));
      panX.setValue(clampedDx);
    },

    onPanResponderRelease: (_evt, gesture) => {
      const dx = gesture.dx;
      const dy = gesture.dy;
      const vx = gesture.vx ?? 0;
      const startX = (gesture.x0 ?? SCREEN_WIDTH / 2);
      const startedFromRight = startX > SCREEN_WIDTH * 0.6;

      const passedDistance = dx < -THRESHOLD && Math.abs(dx) > Math.abs(dy) * 0.7;
      const fastFling = vx < -0.45 && Math.abs(dx) > 12;
      const rightAssist = startedFromRight && dx < -40; 

      if (passedDistance || fastFling || rightAssist) {
        onOpenDetails(item.infoRaw ?? { caption: item.caption, game: item.game, score: item.score });
      }

      Animated.timing(panX, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    },

    onPanResponderTerminationRequest: () => true,
    onPanResponderTerminate: () => {
      Animated.timing(panX, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    },
  })
).current;
  if (item.isEndMessage) {
    return (
      <View style={styles.endContainer}>
        <Text style={styles.endTitle}>No new plays right now.</Text>
        <Text style={styles.endSubtitle}>Scroll up to see recent highlights.</Text>
      </View>
    );
  }

  const translateX = panX.interpolate({
    inputRange: [-350, 0, 350],
    outputRange: [-160, 0, 160], 
    extrapolate: "clamp",
  });

  const opacity = panX.interpolate({
    inputRange: [-350, -THRESHOLD, 0, THRESHOLD, 350],
    outputRange: [0.7, 0.85, 1, 1, 1],
    extrapolate: "clamp",
  });


  return (
    <View style={styles.itemRoot}>
      <Animated.View
        {...panResponder.panHandlers}
        style={{ flex: 1, transform: [{ translateX }], opacity }}
      >
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          android_ripple={{ color: "rgba(255,255,255,0.03)" }}
          style={{ flex: 1 }}
        >
          <View style={styles.videoWrapper}>
            <View style={styles.videoFrame}>
              {item.videoUrl ? (
                <Video
                  ref={videoRef}
                  source={{ uri: item.videoUrl }}
                  style={styles.video}
                  resizeMode={ResizeMode.COVER}
                  isLooping
                  shouldPlay={isActive}
                  useNativeControls={false}
                  progressUpdateIntervalMillis={1000}
                  isMuted={isMuted}
                  volume={1.0}
                />
              ) : (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ color: "#fff" }}>No video</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>

      <View style={styles.captionCard}>
        <Text style={styles.captionText}>{item.caption}</Text>

        <View style={styles.infoRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.gameText}>{item.game}</Text>
            <Text style={styles.sportText}>{item.sport}</Text>
          </View>

          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>{item.score}</Text>
          </View>
        </View>

        <StarRating rating={rating} onChange={handleRatingChange} />
        
        {/* Add visual hint for swipe gesture */}
        <View style={styles.swipeHint}>
          <Text style={styles.swipeHintText}>← Swipe left for details</Text>
        </View>
      </View>
    </View>
  );
}

function DetailsPanel({
  visible,
  info,
  onClose,
}: {
  visible: boolean;
  info: any | null;
  onClose: () => void;
}) {
  const translateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0.6,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: SCREEN_WIDTH,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const safeGet = (o: any, p: string[], fallback = "") => {
    try {
      let cur = o;
      for (const k of p) {
        if (!cur) return fallback;
        cur = cur[k];
      }
      return (cur === undefined || cur === null) ? fallback : cur;
    } catch {
      return fallback;
    }
  };

  const teams = info?.teams ?? {};
  const home = teams.home ?? {};
  const away = teams.away ?? {};
  const homeLabel = home.alias ?? home.name ?? "HOME";
  const awayLabel = away.alias ?? away.name ?? "AWAY";
  const homePoints = (home.points !== undefined && home.points !== null) ? String(home.points) : "";
  const awayPoints = (away.points !== undefined && away.points !== null) ? String(away.points) : "";
  const scoreText = awayPoints !== "" || homePoints !== "" ? `${awayPoints || "0"} - ${homePoints || "0"}` : "";
  const quarter = info?.quarter ?? null;
  const clock = info?.clock ?? "";

  return (
    <>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View 
          pointerEvents={visible ? "auto" : "none"} 
          style={[styles.panelBackdrop, { opacity: backdropOpacity }]} 
        />
      </TouchableWithoutFeedback>
      
      <Animated.View style={[styles.panelContainer, { transform: [{ translateX }] }]}>
        <View style={styles.panelHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.panelGameText}>{`${awayLabel} @ ${homeLabel}`}</Text>
            <Text style={styles.panelScoreText}>{scoreText}</Text>
          </View>

          <TouchableOpacity onPress={onClose} accessibilityLabel="Close details" style={styles.closeButton}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.panelBody}>
          <Text style={styles.panelSectionTitle}>Play Description</Text>
          <Text style={styles.panelPlayText}>{info?.description ?? info?.caption ?? "No description available"}</Text>



          <Text style={styles.panelSectionTitle}>Teams</Text>
          <View style={styles.teamsContainer}>
            <View style={styles.teamItem}>
              <Text style={styles.teamLabel}>Away</Text>
              <Text style={styles.teamName}>
                {away.name || "Away Team"} 
                {away.alias && <Text style={styles.teamAlias}> ({away.alias})</Text>}
              </Text>
              <Text style={styles.teamScore}>{awayPoints || "0"}</Text>
            </View>
            
            <View style={styles.teamVs}>
              <Text style={styles.vsText}>@</Text>
            </View>
            
            <View style={styles.teamItem}>
              <Text style={styles.teamLabel}>Home</Text>
              <Text style={styles.teamName}>
                {home.name || "Home Team"}
                {home.alias && <Text style={styles.teamAlias}> ({home.alias})</Text>}
              </Text>
              <Text style={styles.teamScore}>{homePoints || "0"}</Text>
            </View>
          </View>

          <View style={{ height: 16 }} />

          <View style={styles.gameInfoRow}>
            <View style={styles.gameInfoItem}>
              <Text style={styles.panelSmallLabel}>Quarter</Text>
              <Text style={styles.panelSmallValue}>
                {quarter !== null ? `${quarter}` : "—"}
              </Text>
            </View>
            <View style={styles.gameInfoItem}>
              <Text style={styles.panelSmallLabel}>Clock</Text>
              <Text style={styles.panelSmallValue}>{clock || "—"}</Text>
            </View>
          </View>

          <View style={{ height: 20 }} />

          {info?.transcript ? (
            <>
              <Text style={styles.panelSectionTitle}>Audio Transcript</Text>
              <Text style={styles.panelPlayText}>{info.transcript}</Text>
              <View style={{ height: 20 }} />
            </>
          ) : null}

          <View style={styles.technicalDetails}>
            <Text style={styles.panelSectionTitle}>Technical Details</Text>
            <Text style={styles.panelSmallText}>Job ID: {info?.jobId ?? "—"}</Text>
            <Text style={styles.panelSmallText}>Play Index: {info?.playIndex ?? "—"}</Text>
          </View>
        </View>
      </Animated.View>
    </>
  );
}


export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams() as { selectedSports?: string };
  const { preferredSports } = useAuthContext();

  const isFocused = useIsFocused();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const flatListRef = useRef<FlatList<Highlight>>(null);

  const userPausedRef = useRef<boolean>(false);
  const autoPausedRef = useRef<boolean>(false);
  const holdingRef = useRef<boolean>(false);

  const [isMuted, setIsMuted] = useState<boolean>(false);
  const initialMuteLockRef = useRef<boolean>(false);
  const initialMuteLockTimerRef = useRef<number | null>(null);

  const persistentAnim = useRef(new Animated.Value(1)).current;
  const persistentOpacity = useRef(new Animated.Value(1)).current;
  const ephemeralOpacity = useRef(new Animated.Value(0)).current;

  const [showMuteBadge, setShowMuteBadge] = useState<boolean>(false);
  const muteBadgeTimerRef = useRef<number | null>(null);

  const DEFAULT_BACKEND = "http://172.20.10.6:4000";
  const ANDROID_EMULATOR_BACKEND = "http://10.0.2.2:4000";
  const BACKEND_BASE = Platform.OS === "android" ? ANDROID_EMULATOR_BACKEND : DEFAULT_BACKEND;

  const [backendReels, setBackendReels] = useState<Highlight[]>([]);
  const [loadingReels, setLoadingReels] = useState(false);
  const [reelsError, setReelsError] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const selectedSports = useMemo(() => {
    try {
      if (params?.selectedSports) {
        const parsed = JSON.parse(params.selectedSports);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return preferredSports ?? [];
  }, [params?.selectedSports, preferredSports]);

  const [detailsVisible, setDetailsVisible] = useState(false);
  const [detailsInfo, setDetailsInfo] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadReelsFromApi() {
      setLoadingReels(true);
      setReelsError(null);

      try {
        const listRes = await fetch(`${BACKEND_BASE}/reels`);
        if (!listRes.ok) throw new Error(`status ${listRes.status}`);
        const listJson = await listRes.json();

        const mappedPromises = (listJson || []).map(async (r: any) => {
          const file = r.file as string;
          const videoUrl = r.url ? `${BACKEND_BASE}${r.url}` : undefined;
          let caption = "";
          let game = "";
          let score = "";
          let infoRaw: any = null;

          if (r.infoUrl) {
            try {
              const infoRes = await fetch(`${BACKEND_BASE}${r.infoUrl}`);
              if (infoRes.ok) {
                infoRaw = await infoRes.json();

                const desc = typeof infoRaw.description === "string" ? infoRaw.description : "";
                const q = infoRaw.quarter != null ? infoRaw.quarter : undefined;
                const clock = infoRaw.clock || undefined;
                caption = desc || "";
                if (q !== undefined && clock) {
                  caption = caption ? `${caption} — Q${q} ${clock}` : `Q${q} ${clock}`;
                }

                if (infoRaw.teams && infoRaw.teams.home && infoRaw.teams.away) {
                  const home = infoRaw.teams.home;
                  const away = infoRaw.teams.away;
                  const homeAlias = home.alias || home.name || "HOME";
                  const awayAlias = away.alias || away.name || "AWAY";
                  game = `${awayAlias} @ ${homeAlias}`;
                  const homePts = (typeof home.points === "number" || typeof home.points === "string") ? String(home.points) : "";
                  const awayPts = (typeof away.points === "number" || typeof away.points === "string") ? String(away.points) : "";
                  if (awayPts !== "" || homePts !== "") {
                    score = `${awayPts !== "" ? awayPts : "0"}-${homePts !== "" ? homePts : "0"}`;
                  }
                }
              }
            } catch {
            }
          }

          return {
            id: file,
            videoUrl,
            caption,
            game,
            score,
            sport: "NFL",
            infoRaw,
          } as Highlight;
        });

        const mapped = await Promise.all(mappedPromises);
        if (!mounted) return;
        setBackendReels(mapped);
      } catch (err: any) {
        if (mounted) setReelsError(String(err?.message || err));
      } finally {
        if (mounted) setLoadingReels(false);
      }
    }
    loadReelsFromApi();
    return () => {
      mounted = false;
    };
  }, [BACKEND_BASE]);

  const filtered = useMemo(() => {
    const reelSource = backendReels;
    if (!selectedSports || selectedSports.length === 0) {
      return [...reelSource];
    }
    const wantsNFL = selectedSports.includes("NFL");
    return wantsNFL ? [...reelSource] : [];
  }, [selectedSports, backendReels]);

  const data = useMemo(() => [...filtered, { id: "end", isEndMessage: true }], [filtered]);

  useEffect(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    setCurrentIndex(0);
  }, [selectedSports]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      const vi = viewableItems[0];
      if (vi?.item?.isEndMessage) {
        setCurrentIndex(-1);
        return;
      }
      setCurrentIndex(vi.index);
    }
  }).current;

  const viewabilityConfig = { itemVisiblePercentThreshold: 60 };

  const pulsePersistent = () => {
    persistentAnim.setValue(1);
    persistentOpacity.setValue(1);
    Animated.sequence([
      Animated.timing(persistentAnim, { toValue: 1.12, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(persistentAnim, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  const showEphemeralBadge = (duration = 800) => {
    if (muteBadgeTimerRef.current != null) {
      clearTimeout(muteBadgeTimerRef.current as number);
      muteBadgeTimerRef.current = null;
    }
    setShowMuteBadge(true);
    ephemeralOpacity.setValue(0);
    Animated.timing(ephemeralOpacity, { toValue: 1, duration: 140, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();

    muteBadgeTimerRef.current = (window.setTimeout(() => {
      Animated.timing(ephemeralOpacity, { toValue: 0, duration: 200, useNativeDriver: true, easing: Easing.in(Easing.quad) }).start(() => {
        setShowMuteBadge(false);
        muteBadgeTimerRef.current = null;
      });
    }, duration) as unknown) as number;
  };

  const toggleMute = () => {
    if (initialMuteLockRef.current) {
      return;
    }
    setIsMuted((p) => {
      const next = !p;
      pulsePersistent();
      showEphemeralBadge(800);
      return next;
    });
  };

  const handleHoldStart = () => {
    holdingRef.current = true;
    if (isPlaying) {
      setIsPlaying(false);
    }
  };

  const handleHoldEnd = () => {
    const wasHolding = holdingRef.current;
    holdingRef.current = false;
    if (wasHolding) {
      if (!userPausedRef.current && !autoPausedRef.current) {
        setIsPlaying(true);
      }
    }
  };

  useEffect(() => {
    if (!isFocused) {
      if (isPlaying) {
        setIsPlaying(false);
        autoPausedRef.current = true;
      }
    } else {
      if (autoPausedRef.current && !userPausedRef.current) {
        setIsPlaying(true);
        autoPausedRef.current = false;
      } else {
        autoPausedRef.current = false;
      }
    }
  }, [isFocused]);

  useEffect(() => {
    if (initialMuteLockTimerRef.current != null) {
      clearTimeout(initialMuteLockTimerRef.current as number);
      initialMuteLockTimerRef.current = null;
    }
    setIsMuted(false);
    initialMuteLockRef.current = true;
    initialMuteLockTimerRef.current = (window.setTimeout(() => {
      initialMuteLockRef.current = false;
      initialMuteLockTimerRef.current = null;
    }, MUTE_ACCEPT_DELAY_MS) as unknown) as number;

    showEphemeralBadge(500);
  }, [currentIndex]);

  useEffect(() => {
    return () => {
      if (muteBadgeTimerRef.current != null) clearTimeout(muteBadgeTimerRef.current as number);
      if (initialMuteLockTimerRef.current != null) clearTimeout(initialMuteLockTimerRef.current as number);
    };
  }, []);

  if (!fontsLoaded) return null;

  // open details: show panel with info
  const handleOpenDetails = (info: any | null) => {
    setDetailsInfo(info ?? null);
    setDetailsVisible(true);
  };

  const closeDetails = () => {
    setDetailsVisible(false);
    setTimeout(() => setDetailsInfo(null), 300);
  };

  return (
    <View style={[styles.screenRoot, { paddingTop: Platform.OS === "ios" ? insets.top : 0 }]}>
      <StatusBar style="light" />

      {loadingReels && (
        <View style={{ position: "absolute", top: insets.top + 40, left: 0, right: 0, alignItems: "center", zIndex: 30 }}>
          <View style={{ backgroundColor: "rgba(0,0,0,0.6)", padding: 8, borderRadius: 8 }}>
            <ActivityIndicator color="#fff" />
            <Text style={{ color: "#fff", marginTop: 6 }}>Loading highlights...</Text>
          </View>
        </View>
      )}

      {reelsError && (
        <View style={{ position: "absolute", top: insets.top + 40, left: 0, right: 0, alignItems: "center", zIndex: 30 }}>
          <View style={{ backgroundColor: "rgba(255,0,0,0.6)", padding: 8, borderRadius: 8 }}>
            <Text style={{ color: "#fff", marginTop: 0 }}>Failed to load highlights</Text>
            <Text style={{ color: "#fff", marginTop: 6, fontSize: 12 }}>{reelsError}</Text>
          </View>
        </View>
      )}

      <Pressable onPress={toggleMute} style={[styles.persistentMuteContainer, { top: insets.top + 8, left: 12, zIndex: 50 }]} accessibilityLabel={isMuted ? "Unmute" : "Mute"}>
        <Animated.View style={[styles.muteBadge, { transform: [{ scale: persistentAnim }], opacity: persistentOpacity }]}>
          <Text style={styles.muteEmoji}>{isMuted ? "🔇" : "🔊"}</Text>
        </Animated.View>
      </Pressable>

      <Pressable
        onPress={() => {
          try {
            router.push({ pathname: "/sport-selection", params: { edit: "1" } } as any);
          } catch {
            console.log("Open settings pressed");
          }
        }}
        style={[styles.settingsContainer, { top: insets.top + 8, right: 12, zIndex: 50 }]}
        accessibilityLabel="Open settings"
      >
        <Settings size={20} color="#FFFFFF" />
      </Pressable>

      {showMuteBadge && (
        <Animated.View style={{ position: "absolute", top: insets.top + 56, left: 12, zIndex: 45, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", opacity: ephemeralOpacity, transform: [{ translateY: ephemeralOpacity.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }}>
          <Text style={{ color: "#fff" }}>{isMuted ? "Muted" : "Sound on"}</Text>
        </Animated.View>
      )}

      <FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <VideoItem
            item={item}
            isActive={index === currentIndex && isPlaying}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            onHoldStart={handleHoldStart}
            onHoldEnd={handleHoldEnd}
            safeTop={insets.top}
            onOpenDetails={handleOpenDetails}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        decelerationRate="fast"
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        style={{ flex: 1 }}
      />

      <DetailsPanel visible={detailsVisible} info={detailsInfo} onClose={closeDetails} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    backgroundColor: "#000000",
  },
  itemRoot: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
  },
  videoWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: WRAP_MARGIN,
  },
  videoFrame: {
    width: SCREEN_WIDTH - WRAP_MARGIN * 2,
    height: SCREEN_HEIGHT - WRAP_MARGIN * 2,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: BORDER_WIDTH,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  video: {
    width: "100%",
    height: "100%",
    transform: [{ scale: VIDEO_SCALE }],
    backgroundColor: "#000",
  },
  persistentMuteContainer: {
    position: "absolute",
  },
  muteBadge: {
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  muteEmoji: {
    fontSize: 16,
    color: "#fff",
  },
  settingsContainer: {
    position: "absolute",
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.15)",
  },

  captionCard: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 72,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  captionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    lineHeight: 22,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gameText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  sportText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  scoreBadge: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },

  starRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  rateLabel: {
    color: "#E5E7EB",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  ratingText: {
    color: "#FFD700",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginLeft: 10,
  },

  swipeHint: {
    marginTop: 8,
    alignItems: "center",
  },
  swipeHintText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

  endContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  endTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginBottom: 12,
  },
  endSubtitle: {
    color: "#9CA3AF",
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },

  panelBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    zIndex: 90,
  },
  panelContainer: {
    position: "absolute",
    top: 0,
    right: 0,
    width: Math.min(420, SCREEN_WIDTH * 0.95),
    bottom: 0,
    backgroundColor: "#0f0f10",
    zIndex: 95,
    paddingTop: 50,
    paddingHorizontal: 20,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.08)",
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    paddingBottom: 16,
    marginBottom: 20,
  },
  panelGameText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  panelScoreText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  closeButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  panelBody: {
    flex: 1,
  },
  panelSectionTitle: {
    color: "#E5E7EB",
    fontSize: 14,
    marginBottom: 8,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  panelPlayText: {
    color: "#D1D5DB",
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "Inter_400Regular",
  },
  panelSmallText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  panelSmallLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  panelSmallValue: {
    color: "#E5E7EB",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  gameInfoRow: {
    flexDirection: "row",
    gap: 24,
  },
  gameInfoItem: {
    flex: 1,
  },
  technicalDetails: {
    marginTop: "auto",
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    marginBottom: 20,
  },
    teamsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  teamItem: {
    flex: 1,
    alignItems: "center",
  },
  teamVs: {
    marginHorizontal: 16,
    alignItems: "center",
  },
  vsText: {
    color: "#9CA3AF",
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  teamLabel: {
    color: "#9CA3AF",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  teamName: {
    color: "#E5E7EB",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginBottom: 6,
  },
  teamAlias: {
    color: "#9CA3AF",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    fontWeight: "normal",
  },
  teamScore: {
    color: "#FFFFFF",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },

});