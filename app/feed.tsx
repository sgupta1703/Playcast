// feed.tsx
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    useFonts,
} from "@expo-google-fonts/inter";
import { ResizeMode, Video } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Star } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthContext } from "./auth/AuthProvider";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type Highlight = {
  id: string;
  videoUrl?: string;
  caption?: string;
  game?: string;
  score?: string;
  sport?: string;
  isEndMessage?: boolean;
};

const SAMPLE_HIGHLIGHTS: Highlight[] = [
  {
    id: "1",
    videoUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    caption: "🏀 LeBron James with an incredible dunk to seal the game!",
    game: "Lakers vs Warriors",
    score: "108-102",
    sport: "NBA",
  },
  {
    id: "2",
    videoUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    caption: "⚽ Messi scores a stunning free kick from 30 yards out!",
    game: "Argentina vs Brazil",
    score: "2-1",
    sport: "World Cup",
  },
  {
    id: "3",
    videoUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    caption: "🏈 Mahomes connects deep for a touchdown!",
    game: "Chiefs vs Bills",
    score: "28-21",
    sport: "NFL",
  },
];

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
          <TouchableOpacity
            key={s}
            onPress={() => onChange(s)}
            activeOpacity={0.8}
            style={{ marginHorizontal: 4 }}
            accessibilityLabel={`Rate ${s} star`}
          >
            <Star
              size={20}
              fill={s <= rating ? "#FFD700" : "transparent"}
              color={s <= rating ? "#FFD700" : "rgba(255,255,255,0.35)"}
            />
          </TouchableOpacity>
        ))}
      </View>

      {rating > 0 && <Text style={styles.ratingText}>{rating}/5</Text>}
    </View>
  );
}

function VideoItem({
  item,
  isActive,
  onTogglePlay,
}: {
  item: Highlight;
  isActive: boolean;
  onTogglePlay: () => void;
}) {
  const videoRef = useRef<Video | null>(null);
  const [rating, setRating] = useState<number>(0);

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

  if (item.isEndMessage) {
    return (
      <View style={styles.endContainer}>
        <Text style={styles.endTitle}>No new plays right now.</Text>
        <Text style={styles.endSubtitle}>Scroll up to see recent highlights.</Text>
      </View>
    );
  }

  return (
    <View style={styles.itemRoot}>
      {item.videoUrl ? (
        <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={onTogglePlay}>
          <Video
            ref={videoRef}
            source={{ uri: item.videoUrl }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={isActive}
            useNativeControls={false}
            progressUpdateIntervalMillis={1000}
            // ensure audio props available in case you need them later:
            isMuted={false}
            volume={1.0}
          />
        </TouchableOpacity>
      ) : (
        <View
          style={[
            styles.itemRoot,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <Text style={styles.endTitle}>No new plays right now.</Text>
        </View>
      )}

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

        <StarRating rating={rating} onChange={setRating} />
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams() as { selectedSports?: string };
  const { preferredSports } = useAuthContext();
  const router = useRouter();

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const flatListRef = useRef<FlatList<Highlight>>(null);

  const DEFAULT_BACKEND = "http://172.20.10.6:4000";
  const ANDROID_EMULATOR_BACKEND = "http://10.0.2.2:4000";
  const BACKEND_BASE =
    Platform.OS === "android" ? ANDROID_EMULATOR_BACKEND : DEFAULT_BACKEND;

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
    } catch {
      // ignore
    }
    return preferredSports ?? [];
  }, [params?.selectedSports, preferredSports]);

  // Fetch reels list from backend
  useEffect(() => {
    let mounted = true;
    async function loadReelsFromApi() {
      setLoadingReels(true);
      setReelsError(null);
      try {
        const res = await fetch(`${BACKEND_BASE}/api/reels`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = await res.json();
        if (!mounted) return;

        const mapped: Highlight[] = (json || []).map((r: any) => ({
          id: r.file,
          videoUrl: r.url,
          caption: r.caption,
          game: "",
          score: "",
          sport: "NFL",
        }));

        setBackendReels(mapped);
      } catch (err: any) {
        console.warn("Failed to load reels API:", err?.message || err);
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

  // Compose final filtered list
  const filtered = useMemo(() => {
    const reelSource = backendReels;
    if (!selectedSports || selectedSports.length === 0) {
      const nonNflSamples = SAMPLE_HIGHLIGHTS.filter((h) => h.sport !== "NFL");
      return [...reelSource, ...nonNflSamples];
    }
    const wantsNFL = selectedSports.includes("NFL");
    const sampleFiltered = SAMPLE_HIGHLIGHTS.filter(
      (h) => selectedSports.includes(h.sport) && h.sport !== "NFL"
    );
    return wantsNFL ? [...reelSource, ...sampleFiltered] : sampleFiltered;
  }, [selectedSports, backendReels]);

  const data: Highlight[] = useMemo(
    () => [...filtered, { id: "end", isEndMessage: true }],
    [filtered]
  );

  useEffect(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    setCurrentIndex(0);
  }, [selectedSports]);

  // FIX: when the End message is the visible item we set currentIndex to -1
  // so that no Video is considered active (prevents a previous video from continuing to play)
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      const vi = viewableItems[0];
      // if the visible item is the "end" message, deactivate playback
      if (vi?.item?.isEndMessage) {
        setCurrentIndex(-1); // no video will match this index
        return;
      }
      // otherwise set the currently visible index so that its Video plays
      setCurrentIndex(vi.index);
    }
  }).current;

  const viewabilityConfig = { itemVisiblePercentThreshold: 60 };

  const togglePlay = () => setIsPlaying((p) => !p);

  if (!fontsLoaded) return null;

  return (
    <View style={[styles.screenRoot, { paddingTop: Platform.OS === "ios" ? insets.top : 0 }]}>
      <StatusBar style="light" />

      <TouchableOpacity
        onPress={() => {
          router.push({ pathname: "/sport-selection", params: { edit: "true" } });
        }}
        style={{
          position: "absolute",
          top: (Platform.OS === "ios" ? insets.top : 16) + 8,
          right: 16,
          zIndex: 20,
          backgroundColor: "rgba(255,255,255,0.04)",
          padding: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.06)",
        }}
        accessibilityLabel="Edit preferences"
      >
        <Text style={{ color: "#fff", fontSize: 14 }}>⚙️</Text>
      </TouchableOpacity>

      {loadingReels && (
        <View style={{ position: "absolute", top: 80, left: 0, right: 0, alignItems: "center", zIndex: 30 }}>
          <View style={{ backgroundColor: "rgba(0,0,0,0.6)", padding: 8, borderRadius: 8 }}>
            <ActivityIndicator color="#fff" />
            <Text style={{ color: "#fff", marginTop: 6 }}>Loading NFL highlights...</Text>
          </View>
        </View>
      )}

      {reelsError && (
        <View style={{ position: "absolute", top: 80, left: 0, right: 0, alignItems: "center", zIndex: 30 }}>
          <View style={{ backgroundColor: "rgba(255,0,0,0.6)", padding: 8, borderRadius: 8 }}>
            <Text style={{ color: "#fff", marginTop: 0 }}>Failed to load NFL highlights</Text>
            <Text style={{ color: "#fff", marginTop: 6, fontSize: 12 }}>{reelsError}</Text>
          </View>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <VideoItem item={item} isActive={index === currentIndex && isPlaying} onTogglePlay={togglePlay} />
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
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: "#000",
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
});
