import { useState } from "react";

type Props = {
  url: string;
  ad: string;
};

export default function CikartmaGoruntule({ url, ad }: Props) {
  const [yuklendi, setYuklendi] = useState(false);

  return (
    <div
      className="cikartma-kapsayici"
      style={{
        display: "inline-block",
        margin: "4px 0",
        maxWidth: 160,
        maxHeight: 160,
      }}
    >
      <img
        src={url}
        alt={ad}
        title={ad}
        loading="lazy"
        onLoad={() => setYuklendi(true)}
        style={{
          display: "block",
          maxWidth: "100%",
          maxHeight: 160,
          objectFit: "contain",
          filter: yuklendi ? "none" : "blur(4px)",
          transition: "transform 0.18s ease, filter 0.2s ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      />
    </div>
  );
}
