#!/bin/bash
# Generate template preview thumbnails using ImageMagick
set -e
OUTDIR="$(cd "$(dirname "$0")/.." && pwd)/frontend/templates"
mkdir -p "$OUTDIR"

W=600
H=776
M=50           # margin
CW=$((W-2*M))  # content width
RX=$((W-M))    # right edge x

generate() {
  local id="$1" primary="$2" subtle="$3" align="$4" bstyle="$5" bcolor="$6" nfont="$7" sz="$8"

  # Font mapping
  local SANS="Arial"
  local SANS_B="Arial-Bold"
  local SERIF="Georgia"
  local SERIF_B="Georgia-Bold"
  local nf="$SANS_B"
  [ "$nfont" = "serif" ] && nf="$SERIF_B"

  # Sizes
  local ns=22 cs=9 ss=11 bs=8 lh=14
  [ "$sz" = "compact" ] && ns=19 && cs=8 && ss=10 && bs=7 && lh=12

  local args="-size ${W}x${H} xc:white"
  local y=45

  # === NAME ===
  if [ "$align" = "center" ]; then
    args="$args -gravity North -fill '${primary}' -font $nf -pointsize $ns"
    args="$args -annotate +0+${y} 'VIOLET RODRIGUEZ'"
  else
    args="$args -gravity NorthWest -fill '${primary}' -font $nf -pointsize $ns"
    args="$args -annotate +${M}+${y} 'VIOLET RODRIGUEZ'"
  fi
  y=$((y+ns+10))

  # === CONTACT ===
  args="$args -gravity NorthWest -font $SANS -pointsize $cs -fill '${subtle}'"
  if [ "$align" = "center" ]; then
    args="$args -gravity North -annotate +0+${y} 'New York, NY | violet@email.com | (555) 123-4567'"
  else
    args="$args -annotate +${M}+${y} 'New York, NY | violet@email.com | (555) 123-4567'"
  fi
  y=$((y+cs+22))

  # === SECTION HEADER HELPER ===
  section() {
    local label="$1"
    args="$args -gravity NorthWest"
    case "$bstyle" in
      shading)
        local by=$((y-4)) bh=$((ss+10))
        args="$args -fill '${bcolor}' -draw 'rectangle ${M},${by} ${RX},$((by+bh))'"
        args="$args -font $SANS_B -pointsize $ss -fill '${primary}' -annotate +$((M+5))+$((y+1)) '${label}'"
        y=$((y+bh+8))
        ;;
      top-bottom)
        local tly=$((y-4))
        args="$args -stroke '${bcolor}' -strokewidth 1 -draw 'line ${M},${tly} ${RX},${tly}' -stroke none"
        args="$args -font $SANS_B -pointsize $ss -fill '${primary}' -annotate +${M}+$((y+2)) '${label}'"
        y=$((y+ss+5))
        args="$args -stroke '${bcolor}' -strokewidth 1 -draw 'line ${M},${y} ${RX},${y}' -stroke none"
        y=$((y+9))
        ;;
      bottom)
        args="$args -font $SANS_B -pointsize $ss -fill '${primary}' -annotate +${M}+${y} '${label}'"
        y=$((y+ss+3))
        args="$args -stroke '${bcolor}' -strokewidth 1 -draw 'line ${M},${y} ${RX},${y}' -stroke none"
        y=$((y+8))
        ;;
      thick-bottom)
        args="$args -font $SANS_B -pointsize $ss -fill '${primary}' -annotate +${M}+${y} '${label}'"
        y=$((y+ss+3))
        args="$args -stroke '${bcolor}' -strokewidth 3 -draw 'line ${M},${y} ${RX},${y}' -stroke none"
        y=$((y+9))
        ;;
      none)
        args="$args -font $SANS_B -pointsize $ss -fill '${primary}' -annotate +${M}+${y} '${label}'"
        y=$((y+ss+10))
        ;;
    esac
  }

  # === TEXT LINE HELPER (gray bar) ===
  textlines() {
    local count=$1 indent=${2:-0}
    local lx=$((M+indent))
    for i in $(seq 1 $count); do
      local lw=$((CW-indent-30-(i*17 % 50)))
      [ $lw -gt $((CW-indent)) ] && lw=$((CW-indent))
      args="$args -fill '#D0D0D0' -draw 'rectangle ${lx},${y} $((lx+lw)),$((y+bs-2))'"
      y=$((y+lh))
    done
  }

  # === BULLET HELPER ===
  bullets() {
    local count=$1
    for i in $(seq 1 $count); do
      local dx=$((M+8))
      local dy=$((y+bs/2))
      args="$args -fill '#999999' -draw 'circle ${dx},${dy} $((dx+2)),${dy}'"
      local lw=$((CW-25-(i*23 % 70)))
      args="$args -fill '#D0D0D0' -draw 'rectangle $((M+16)),${y} $((M+16+lw)),$((y+bs-2))'"
      y=$((y+lh))
    done
  }

  # === PROFESSIONAL SUMMARY ===
  section "PROFESSIONAL SUMMARY"
  textlines 3
  y=$((y+6))

  # === TECHNICAL SKILLS ===
  section "TECHNICAL SKILLS"
  for cat in "Languages:" "Frameworks:" "Cloud & DevOps:"; do
    args="$args -gravity NorthWest -font $SANS_B -pointsize $bs -fill '#666666' -annotate +${M}+${y} '${cat}'"
    local ix=$((M+72)) iw=$((CW-82))
    args="$args -fill '#D0D0D0' -draw 'rectangle ${ix},${y} $((ix+iw)),$((y+bs-2))'"
    y=$((y+lh))
  done
  y=$((y+6))

  # === PROFESSIONAL EXPERIENCE ===
  section "PROFESSIONAL EXPERIENCE"

  # Entry 1
  args="$args -gravity NorthWest -font $SANS_B -pointsize $((bs+1)) -fill '${primary}' -annotate +${M}+${y} 'Acme Technologies'"
  args="$args -font $SANS -pointsize $bs -fill '${subtle}' -annotate +$((RX-95))+${y} 'Jan 2022 — Present'"
  y=$((y+lh))
  args="$args -font $SANS -pointsize $bs -fill '#666666' -annotate +${M}+${y} 'Senior Software Engineer  •  San Francisco, CA'"
  y=$((y+lh+2))
  bullets 3
  y=$((y+4))

  # Entry 2
  args="$args -gravity NorthWest -font $SANS_B -pointsize $((bs+1)) -fill '${primary}' -annotate +${M}+${y} 'Digital Solutions Inc.'"
  args="$args -font $SANS -pointsize $bs -fill '${subtle}' -annotate +$((RX-100))+${y} 'Mar 2019 — Dec 2021'"
  y=$((y+lh))
  args="$args -font $SANS -pointsize $bs -fill '#666666' -annotate +${M}+${y} 'Software Engineer  •  New York, NY'"
  y=$((y+lh+2))
  bullets 3
  y=$((y+4))

  # Entry 3
  args="$args -gravity NorthWest -font $SANS_B -pointsize $((bs+1)) -fill '${primary}' -annotate +${M}+${y} 'StartupCo'"
  args="$args -font $SANS -pointsize $bs -fill '${subtle}' -annotate +$((RX-95))+${y} 'Jun 2017 — Feb 2019'"
  y=$((y+lh))
  args="$args -font $SANS -pointsize $bs -fill '#666666' -annotate +${M}+${y} 'Junior Developer  •  Austin, TX'"
  y=$((y+lh+2))
  bullets 2
  y=$((y+6))

  # === EDUCATION ===
  if [ $y -lt $((H-80)) ]; then
    section "EDUCATION"
    args="$args -gravity NorthWest -font $SANS_B -pointsize $((bs+1)) -fill '${primary}' -annotate +${M}+${y} 'University of California, Berkeley'"
    args="$args -font $SANS -pointsize $bs -fill '${subtle}' -annotate +$((RX-65))+${y} '2013 — 2017'"
    y=$((y+lh))
    args="$args -font $SANS -pointsize $bs -fill '#666666' -annotate +${M}+${y} 'Bachelor of Science, Computer Science  •  Berkeley, CA'"
  fi

  # Generate
  eval magick $args -quality 92 "\"$OUTDIR/${id}.jpg\""
  echo "  $id.jpg"
}

generate_twocol() {
  local id="$1" primary="$2" subtle="$3" sidebar_bg="$4" sidebar_fg="$5" bstyle="$6" bcolor="$7"

  local SANS="Arial"
  local SANS_B="Arial-Bold"
  local bs=8 ss=10 lh=13
  local SW=185  # sidebar width
  local SX=0    # sidebar x start
  local MX=$((SW+25))  # main content x start
  local MCW=$((W-MX-M))  # main content width
  local SMARG=20  # sidebar inner margin

  local args="-size ${W}x${H} xc:white"

  # === SIDEBAR BACKGROUND ===
  args="$args -fill '${sidebar_bg}' -draw 'rectangle 0,0 ${SW},${H}'"

  local y=45 sy=45

  # === NAME (in sidebar) ===
  args="$args -gravity NorthWest -fill '${sidebar_fg}' -font $SANS_B -pointsize 16"
  args="$args -annotate +${SMARG}+${sy} 'VIOLET'"
  sy=$((sy+20))
  args="$args -annotate +${SMARG}+${sy} 'RODRIGUEZ'"
  sy=$((sy+22))

  # === CONTACT (sidebar) ===
  args="$args -font $SANS -pointsize 7 -fill '${sidebar_fg}'"
  args="$args -annotate +${SMARG}+${sy} 'New York, NY'"
  sy=$((sy+12))
  args="$args -annotate +${SMARG}+${sy} 'violet@email.com'"
  sy=$((sy+12))
  args="$args -annotate +${SMARG}+${sy} '(555) 123-4567'"
  sy=$((sy+20))

  # === SKILLS (sidebar) ===
  args="$args -font $SANS_B -pointsize $ss -fill '${sidebar_fg}'"
  args="$args -annotate +${SMARG}+${sy} 'SKILLS'"
  sy=$((sy+ss+4))
  # Sidebar divider
  args="$args -stroke '${sidebar_fg}' -strokewidth 1 -draw 'line ${SMARG},${sy} $((SW-SMARG)),${sy}' -stroke none"
  sy=$((sy+8))
  # Skill items
  for skill in "Python" "TypeScript" "React" "Node.js" "AWS" "Docker" "PostgreSQL" "GraphQL"; do
    args="$args -font $SANS -pointsize 7 -fill '${sidebar_fg}' -annotate +${SMARG}+${sy} '${skill}'"
    sy=$((sy+12))
  done
  sy=$((sy+10))

  # === EDUCATION (sidebar) ===
  args="$args -font $SANS_B -pointsize $ss -fill '${sidebar_fg}'"
  args="$args -annotate +${SMARG}+${sy} 'EDUCATION'"
  sy=$((sy+ss+4))
  args="$args -stroke '${sidebar_fg}' -strokewidth 1 -draw 'line ${SMARG},${sy} $((SW-SMARG)),${sy}' -stroke none"
  sy=$((sy+8))
  args="$args -font $SANS_B -pointsize 7 -fill '${sidebar_fg}' -annotate +${SMARG}+${sy} 'UC Berkeley'"
  sy=$((sy+12))
  args="$args -font $SANS -pointsize 7 -fill '${sidebar_fg}' -annotate +${SMARG}+${sy} 'B.S. Computer Science'"
  sy=$((sy+12))
  args="$args -font $SANS -pointsize 7 -fill '${sidebar_fg}' -annotate +${SMARG}+${sy} '2013 — 2017'"

  # === MAIN: Section header helper ===
  section_main() {
    local label="$1"
    args="$args -gravity NorthWest"
    case "$bstyle" in
      bottom)
        args="$args -font $SANS_B -pointsize $ss -fill '${primary}' -annotate +${MX}+${y} '${label}'"
        y=$((y+ss+3))
        args="$args -stroke '${bcolor}' -strokewidth 1 -draw 'line ${MX},${y} ${RX},${y}' -stroke none"
        y=$((y+8))
        ;;
      shading)
        local by=$((y-3)) bh=$((ss+8))
        args="$args -fill '${bcolor}' -draw 'rectangle ${MX},${by} ${RX},$((by+bh))'"
        args="$args -font $SANS_B -pointsize $ss -fill '${primary}' -annotate +$((MX+4))+$((y+1)) '${label}'"
        y=$((y+bh+8))
        ;;
      none)
        args="$args -font $SANS_B -pointsize $ss -fill '${primary}' -annotate +${MX}+${y} '${label}'"
        y=$((y+ss+10))
        ;;
    esac
  }

  bullets_main() {
    local count=$1
    for i in $(seq 1 $count); do
      local dx=$((MX+8))
      local dy=$((y+bs/2))
      args="$args -fill '#999999' -draw 'circle ${dx},${dy} $((dx+2)),${dy}'"
      local lw=$((MCW-25-(i*19 % 60)))
      args="$args -fill '#D0D0D0' -draw 'rectangle $((MX+16)),${y} $((MX+16+lw)),$((y+bs-2))'"
      y=$((y+lh))
    done
  }

  # === PROFESSIONAL SUMMARY (main) ===
  section_main "PROFESSIONAL SUMMARY"
  for i in 1 2 3; do
    local lw=$((MCW-20-(i*13 % 40)))
    args="$args -fill '#D0D0D0' -draw 'rectangle ${MX},${y} $((MX+lw)),$((y+bs-2))'"
    y=$((y+lh))
  done
  y=$((y+6))

  # === EXPERIENCE (main) ===
  section_main "PROFESSIONAL EXPERIENCE"

  # Entry 1
  args="$args -gravity NorthWest -font $SANS_B -pointsize $((bs+1)) -fill '${primary}' -annotate +${MX}+${y} 'Acme Technologies'"
  args="$args -font $SANS -pointsize $bs -fill '${subtle}' -annotate +$((RX-90))+${y} 'Jan 2022 — Present'"
  y=$((y+lh))
  args="$args -font $SANS -pointsize $bs -fill '#666666' -annotate +${MX}+${y} 'Senior Software Engineer'"
  y=$((y+lh+2))
  bullets_main 3
  y=$((y+4))

  # Entry 2
  args="$args -gravity NorthWest -font $SANS_B -pointsize $((bs+1)) -fill '${primary}' -annotate +${MX}+${y} 'Digital Solutions Inc.'"
  args="$args -font $SANS -pointsize $bs -fill '${subtle}' -annotate +$((RX-90))+${y} 'Mar 2019 — Dec 2021'"
  y=$((y+lh))
  args="$args -font $SANS -pointsize $bs -fill '#666666' -annotate +${MX}+${y} 'Software Engineer'"
  y=$((y+lh+2))
  bullets_main 3
  y=$((y+4))

  # Entry 3
  args="$args -gravity NorthWest -font $SANS_B -pointsize $((bs+1)) -fill '${primary}' -annotate +${MX}+${y} 'StartupCo'"
  args="$args -font $SANS -pointsize $bs -fill '${subtle}' -annotate +$((RX-90))+${y} 'Jun 2017 — Feb 2019'"
  y=$((y+lh))
  args="$args -font $SANS -pointsize $bs -fill '#666666' -annotate +${MX}+${y} 'Junior Developer'"
  y=$((y+lh+2))
  bullets_main 2

  eval magick $args -quality 92 "\"$OUTDIR/${id}.jpg\""
  echo "  $id.jpg (two-column)"
}

echo "Generating template previews..."

# Existing single-column
generate "classic"       "#000000" "#666666" "center" "none"          "#000000" "sans"  "normal"
generate "elegant"       "#1A7A7A" "#666666" "center" "bottom"       "#1A7A7A" "serif" "normal"
generate "single-column" "#2B579A" "#666666" "left"   "bottom"       "#2B579A" "sans"  "normal"
generate "ivy-league"    "#000000" "#666666" "center" "bottom"       "#000000" "serif" "normal"

# New single-column
generate "executive"     "#1B2A4A" "#555555" "center" "top-bottom"   "#1B2A4A" "serif" "normal"
generate "highlight"     "#1A7A7A" "#666666" "left"   "shading"      "#E0F0F0" "sans"  "normal"
generate "compact"       "#000000" "#555555" "left"   "bottom"       "#000000" "sans"  "compact"
generate "accent"        "#B8860B" "#666666" "left"   "thick-bottom" "#B8860B" "sans"  "normal"
generate "minimal"       "#444444" "#777777" "left"   "none"         "#444444" "sans"  "normal"
generate "professional"  "#8B0000" "#666666" "left"   "bottom"       "#8B0000" "sans"  "normal"

# Two-column templates: id, primary, subtle, sidebar_bg, sidebar_fg, bstyle, bcolor
generate_twocol "modern"    "#2B579A" "#666666" "#2B579A" "#FFFFFF" "bottom"  "#2B579A"
generate_twocol "timeline"  "#333333" "#777777" "#F5F5F0" "#333333" "none"    "#333333"
generate_twocol "polished"  "#1B2A4A" "#555555" "#1B2A4A" "#FFFFFF" "bottom"  "#1B2A4A"
generate_twocol "creative"  "#E85D04" "#666666" "#2D2D2D" "#FFFFFF" "shading" "#FFF3E0"
generate_twocol "stylish"   "#6A0DAD" "#666666" "#6A0DAD" "#FFFFFF" "bottom"  "#6A0DAD"

echo ""
echo "Done! Generated $(ls "$OUTDIR"/*.jpg 2>/dev/null | wc -l | tr -d ' ') thumbnails."
