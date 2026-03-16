import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function DatasetPage() {
  const { org, dataset } = useParams<{ org: string; dataset: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (org && dataset) {
      navigate(`/${org}/${dataset}/episode_0`, { replace: true });
    }
  }, [org, dataset, navigate]);

  return null;
}
