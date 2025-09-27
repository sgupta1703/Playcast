import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  Dimensions,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video, ResizeMode } from "expo-av";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { Star } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthContext } from "./auth/AuthProvider";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/* ---------- types & sample data unchanged ---------- */
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
  {
    id: "4",
    videoUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    caption: "🎾 Ace down the middle to close the set — clinical!",
    game: "S. Williams vs M. Sharapova",
    score: "6-4, 6-3",
    sport: "Wimbledon",
  },
  {
    id: "5",
    videoUrl:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    caption: "⚾ Big home run to put the game out of reach!",
    game: "Yankees vs Red Sox",
    score: "7-4",
    sport: "MLB",
  },
];

/* ---------- StarRating & VideoItem unchanged (same UI as you had) ---------- */

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
      } catch (e) {
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
          />
        </TouchableOpacity>
      ) : (
        <View style={[styles.itemRoot, { justifyContent: "center", alignItems: "center" }]}>
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

  const selectedSports = useMemo(() => {
    try {
      if (params?.selectedSports) {
        const parsed = JSON.parse(params.selectedSports);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
    }
    return preferredSports ?? [];
  }, [params?.selectedSports, preferredSports]);

  const filtered = useMemo(() => {
    if (!selectedSports || selectedSports.length === 0) return SAMPLE_HIGHLIGHTS;
    return SAMPLE_HIGHLIGHTS.filter((h) => selectedSports.includes(h.sport));
  }, [selectedSports]);

  const data: Highlight[] = useMemo(() => [...filtered, { id: "end", isEndMessage: true }], [filtered]);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    setCurrentIndex(0);
  }, [selectedSports]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      const vi = viewableItems[0];
      if (vi?.item?.isEndMessage) return;
      setCurrentIndex(vi.index);
    }
  }).current;

  const viewabilityConfig = { itemVisiblePercentThreshold: 60 };

  const togglePlay = () => setIsPlaying((p) => !p);

  if (!fontsLoaded) return null;

  return (
    <View style={[styles.screenRoot, { paddingTop: Platform.OS === "ios" ? insets.top : 0 }]}>
      <StatusBar style="light" />

      {/* Edit button (top-right) */}
      <TouchableOpacity
        onPress={() => {
          // open sport-selection in edit mode
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
