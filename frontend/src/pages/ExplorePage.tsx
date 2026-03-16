import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { postParentMessageWithParams } from "@/utils/postParentMessage";
import {
  getDatasetVersion,
  buildVersionedUrl,
} from "@/utils/versionUtils";
import {
  fetchJson,
  formatStringWithVars,
} from "@/utils/parquetUtils";
import type { DatasetMetadata } from "@/utils/parquetUtils";

type DatasetWithVideo = { id: string; videoUrl: string | null };

export default function ExplorePage() {
  const [datasets, setDatasets] = useState<DatasetWithVideo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    postParentMessageWithParams((params: URLSearchParams) => {
      params.set("path", window.location.pathname + window.location.search);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const page = parseInt(params.get("p") || "1", 10);
    setCurrentPage(page);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(
          "https://huggingface.co/api/datasets?sort=lastModified&filter=LeRobot",
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("Failed to fetch datasets");
        const data = await res.json();
        const allDatasets: { id: string }[] = data.datasets || data;
        const perPage = 30;
        const pages = Math.ceil(allDatasets.length / perPage);
        const startIdx = (currentPage - 1) * perPage;
        const pageDatasets = allDatasets.slice(startIdx, startIdx + perPage);

        if (cancelled) return;
        setTotalPages(pages);

        const results = (
          await Promise.all(
            pageDatasets.map(async (ds) => {
              try {
                const [org, dataset] = ds.id.split("/");
                const repoId = `${org}/${dataset}`;
                let version: string;
                try {
                  version = await getDatasetVersion(repoId);
                } catch {
                  return null;
                }
                const jsonUrl = buildVersionedUrl(
                  repoId,
                  version,
                  "meta/info.json",
                );
                const info = await fetchJson<DatasetMetadata>(jsonUrl);
                const videoEntry = Object.entries(info.features).find(
                  ([, value]) => value.dtype === "video",
                );
                let videoUrl: string | null = null;
                if (videoEntry && info.video_path) {
                  const [key] = videoEntry;
                  const videoPath = formatStringWithVars(info.video_path, {
                    video_key: key,
                    episode_chunk: "0".padStart(3, "0"),
                    episode_index: "0".padStart(6, "0"),
                  });
                  const url = buildVersionedUrl(repoId, version, videoPath);
                  try {
                    const headRes = await fetch(url, { method: "HEAD" });
                    if (headRes.ok) videoUrl = url;
                  } catch {
                    // ignore
                  }
                }
                return videoUrl ? { id: repoId, videoUrl } : null;
              } catch {
                return null;
              }
            }),
          )
        ).filter(Boolean) as DatasetWithVideo[];

        if (!cancelled) {
          setDatasets(results);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Failed to load datasets.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }

  if (loading) {
    return <div className="p-8 text-slate-400">Loading datasets...</div>;
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Explore LeRobot Datasets</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {datasets.map((ds, idx) => (
          <Link
            key={ds.id}
            to={`/${ds.id}`}
            className="relative border rounded-lg p-4 bg-white shadow hover:shadow-lg transition overflow-hidden h-48 flex items-end group"
            onMouseEnter={() => {
              const vid = videoRefs.current[idx];
              if (vid) vid.play();
            }}
            onMouseLeave={() => {
              const vid = videoRefs.current[idx];
              if (vid) {
                vid.pause();
                vid.currentTime = 0;
              }
            }}
          >
            <video
              ref={(el) => {
                videoRefs.current[idx] = el;
              }}
              src={ds.videoUrl || undefined}
              className="absolute top-0 left-0 w-full h-full object-cover object-center z-0"
              loop
              muted
              playsInline
              preload="metadata"
              onTimeUpdate={(e) => {
                const vid = e.currentTarget;
                if (vid.currentTime >= 15) {
                  vid.pause();
                  vid.currentTime = 0;
                }
              }}
            />
            <div className="absolute top-0 left-0 w-full h-full bg-black/40 z-10 pointer-events-none" />
            <div className="relative z-20 font-mono text-blue-100 break-all text-sm bg-black/60 backdrop-blur px-2 py-1 rounded shadow">
              {ds.id}
            </div>
          </Link>
        ))}
      </div>
      <div className="flex justify-center mt-8 gap-4">
        {currentPage > 1 && (
          <button
            className="px-6 py-2 bg-gray-600 text-white rounded shadow hover:bg-gray-700 transition"
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              params.set("p", (currentPage - 1).toString());
              window.location.search = params.toString();
            }}
          >
            Previous
          </button>
        )}
        {currentPage < totalPages && (
          <button
            className="px-6 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition"
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              params.set("p", (currentPage + 1).toString());
              window.location.search = params.toString();
            }}
          >
            Next
          </button>
        )}
      </div>
    </main>
  );
}
