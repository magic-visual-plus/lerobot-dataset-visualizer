import { Suspense } from "react";
import { useParams } from "react-router-dom";
import EpisodeViewer from "@/components/episode-viewer";

export default function EpisodePage() {
  const { org, dataset, episode } = useParams<{
    org: string;
    dataset: string;
    episode: string;
  }>();

  if (!org || !dataset || !episode) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-red-400">
        Invalid route parameters.
      </div>
    );
  }

  const episodeNumber = Number(episode.replace(/^episode_/, ""));

  return (
    <Suspense fallback={null}>
      <EpisodeViewer org={org} dataset={dataset} episodeId={episodeNumber} />
    </Suspense>
  );
}
