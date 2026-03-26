import { useEffect, useState } from "react";
import BackgroundReplaceToolPage from "./pages/BackgroundReplaceToolPage.jsx";
import CutoutToolPage from "./pages/CutoutToolPage.jsx";
import ImageSplitToolPage from "./pages/ImageSplitToolPage.jsx";
import StatsDashboardPage from "./pages/StatsDashboardPage.jsx";
import ToolsHomePage from "./pages/ToolsHomePage.jsx";
import VideoFrameToolPage from "./pages/VideoFrameToolPage.jsx";
import {
  clearAnalyticsSnapshot,
  readAnalyticsSnapshot,
  recordRouteVisit,
  recordToolClick,
} from "./lib/analyticsStore.js";

const HOME_HASH = "#/";
const CUTOUT_HASH = "#/tools/cutout";
const BACKGROUND_REPLACE_HASH = "#/tools/background-replace";
const IMAGE_SPLIT_HASH = "#/tools/image-split";
const VIDEO_FRAME_HASH = "#/tools/video-frame";
const STATS_HASH = "#/stats";

function readRouteFromHash() {
  if (typeof window === "undefined") {
    return "home";
  }

  const rawHash = window.location.hash.replace(/^#/, "");
  const normalized = rawHash === "" ? "/" : rawHash.replace(/\/+$/, "") || "/";

  if (normalized === "/" || normalized === "") {
    return "home";
  }

  if (normalized === "/tools/cutout" || normalized === "tools/cutout" || normalized === "/cutout") {
    return "cutout";
  }

  if (
    normalized === "/tools/background-replace" ||
    normalized === "tools/background-replace" ||
    normalized === "/background-replace" ||
    normalized === "/tools/background"
  ) {
    return "backgroundReplace";
  }

  if (
    normalized === "/tools/image-split" ||
    normalized === "tools/image-split" ||
    normalized === "/image-split" ||
    normalized === "/tools/split"
  ) {
    return "imageSplit";
  }

  if (
    normalized === "/tools/video-frame" ||
    normalized === "tools/video-frame" ||
    normalized === "/video-frame" ||
    normalized === "/tools/video-frames"
  ) {
    return "videoFrame";
  }

  if (normalized === "/stats" || normalized === "stats" || normalized === "/tools/stats") {
    return "stats";
  }

  return "home";
}

export default function App() {
  const [route, setRoute] = useState(() => readRouteFromHash());
  const [analytics, setAnalytics] = useState(() => readAnalyticsSnapshot());

  useEffect(() => {
    const syncRoute = () => setRoute(readRouteFromHash());

    window.addEventListener("hashchange", syncRoute);
    syncRoute();

    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  useEffect(() => {
    if (route === "cutout") {
      document.title = "抠图 | 工具集";
      return;
    }

    if (route === "backgroundReplace") {
      document.title = "背景替换 | 工具集";
      return;
    }

    if (route === "imageSplit") {
      document.title = "图片拆分 | 工具集";
      return;
    }

    if (route === "videoFrame") {
      document.title = "视频帧提取 | 工具集";
      return;
    }

    if (route === "stats") {
      document.title = "访问统计 | 工具集";
      return;
    }

    document.title = "工具集";
  }, [route]);

  useEffect(() => {
    setAnalytics(recordRouteVisit(route));
  }, [route]);

  const refreshAnalytics = () => {
    setAnalytics(readAnalyticsSnapshot());
  };

  const handleToolClick = (toolKey, toolName) => {
    setAnalytics(recordToolClick(toolKey, toolName));
  };

  const handleClearAnalytics = (nextSnapshot) => {
    setAnalytics(nextSnapshot || clearAnalyticsSnapshot());
  };

  if (route === "cutout") {
    return <CutoutToolPage homeHref={HOME_HASH} />;
  }

  if (route === "backgroundReplace") {
    return <BackgroundReplaceToolPage homeHref={HOME_HASH} />;
  }

  if (route === "imageSplit") {
    return <ImageSplitToolPage homeHref={HOME_HASH} />;
  }

  if (route === "videoFrame") {
    return <VideoFrameToolPage homeHref={HOME_HASH} />;
  }

  if (route === "stats") {
    return (
      <StatsDashboardPage
        homeHref={HOME_HASH}
        analytics={analytics}
        onRefreshAnalytics={refreshAnalytics}
        onClearAnalytics={handleClearAnalytics}
      />
    );
  }

  return (
    <ToolsHomePage
      cutoutHref={CUTOUT_HASH}
      backgroundReplaceHref={BACKGROUND_REPLACE_HASH}
      imageSplitHref={IMAGE_SPLIT_HASH}
      videoFrameHref={VIDEO_FRAME_HASH}
      statsHref={STATS_HASH}
      onToolClick={handleToolClick}
    />
  );
}
