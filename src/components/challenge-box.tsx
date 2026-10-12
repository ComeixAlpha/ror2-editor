import React, { useState } from "react";
import {
  DLC_LABELS,
  describeUnlocks,
  iconFallbackUrlFor,
  iconUrlFor,
  requiredDlcForUnlock,
} from "../data/catalog";
import type { Challenge } from "../data/catalog";

import { achievementTokens } from "../i18n/lang";
import { useI18n } from "../i18n";
import "./challenge-box.css";

interface Props {
  challenge: Challenge;
  unlocked: boolean;
  /** True for the moment right after this challenge was granted, to play the flourish. */
  justGranted: boolean;
  onToggle: (challenge: Challenge, selected: boolean) => void;
}

export default function ChallengeBox({
  challenge,
  unlocked,
  justGranted,
  onToggle,
}: Props): React.JSX.Element {
  const { t, g, dlcLabel } = useI18n();
  // The catalogue stores resolved English rather than tokens, so the pair is rebuilt
  // from the achievement id -- the same convention the extractor keys the language files on.
  const tokens = achievementTokens(challenge.achievement);
  const iconUrl = iconUrlFor(challenge.achievement);
  const fallbackUrl = iconFallbackUrlFor(challenge.achievement);
  // If the image fails to load there is nothing useful to show, so fall back to the placeholder
  // rather than leaving a broken-image glyph.
  const [failed, setFailed] = useState(false);
  const showIcon = iconUrl !== undefined && !failed;

  // A skin for a base-game survivor can still require an expansion. Say so, because otherwise the
  // reward silently does nothing for a player who does not own that DLC.
  const rewardDlc =
    challenge.unlocks.length > 0
      ? requiredDlcForUnlock(challenge.unlocks[0])
      : "base";
  const needsOtherDlc = rewardDlc !== challenge.dlc;

  return (
    <button
      type="button"
      className={`challenge ${unlocked ? "selected" : ""}${justGranted ? " just-granted" : ""}`}
      onClick={() => onToggle(challenge, !unlocked)}
    >
      <div className="icon">
        {showIcon ? (
          fallbackUrl ? (
            // Curated icons ship as webp with a png fallback.
            <picture>
              <source type="image/webp" srcSet={iconUrl} />
              <img
                src={fallbackUrl}
                alt=""
                loading="lazy"
                onError={() => setFailed(true)}
              />
            </picture>
          ) : (
            <img
              src={iconUrl}
              alt=""
              loading="lazy"
              onError={() => setFailed(true)}
            />
          )
        ) : (
          // Placeholder: the game has no icon asset for this achievement.
          <span className="icon-placeholder" aria-hidden />
        )}
      </div>

      <div className="text">
        <p className="name">{g(tokens.name, challenge.name)}</p>
        <p className="desc">{g(tokens.description, challenge.description)}</p>
        <p className="unlock">{describeUnlocks(challenge)}</p>
        <p className="tags">
          <span className={`dlc-badge dlc-${challenge.dlc}`}>
            {dlcLabel(challenge.dlc)}
          </span>
          {needsOtherDlc ? (
            <span className={`dlc-badge dlc-${rewardDlc}`}>
              needs {dlcLabel(rewardDlc)}
            </span>
          ) : null}
          {challenge.prerequisite ? (
            <span className="prereq">{t("requires")} {challenge.prerequisite}</span>
          ) : null}
        </p>
      </div>
    </button>
  );
}
