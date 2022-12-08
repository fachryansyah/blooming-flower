const { videoInfo } = require("ytdl-core");
const ytdl = require("ytdl-core");

const { Canvas } = require("terminal-canvas");

const ChopStream = require("chop-stream");
const { Throttle } = require("stream-throttle");
const ffmpeg = require("fluent-ffmpeg");

const YOUTUBE_URL =
  process.env.YOUTUBE_URL ?? "https://www.youtube.com/watch?v=AqoTzHaNhos&ab_channel=Carma001";
const CHARACTERS = " .,:;i1tfLCG08@".split("");
const canvas = Canvas.create().reset();

function playVideo(info) {
  const video = info.formats.find(
    (format) =>
      format.quality === "tiny" &&
      format.container === "webm" &&
      typeof format.audioChannels === "undefined"
  );

  const videoSize = { width: video.width, height: video.height };
  const scale = Math.min(
    canvas.width / videoSize.width,
    canvas.height / videoSize.height
  );
  const frameWidth = Math.floor(videoSize.width * scale);
  const frameHeight = Math.floor(videoSize.height * scale);
  const frameSize = frameWidth * frameHeight * 3;

  ffmpeg(video.url)
    .format("rawvideo")
    .videoFilters([
      { filter: "fps", options: 30 },
      { filter: "scale", options: `${frameWidth}:${frameHeight}` },
    ])
    .outputOptions("-pix_fmt", "rgb24")
    .outputOptions("-update", "1")
    .on("start", () => canvas.saveScreen().reset())
    .on("end", () => canvas.restoreScreen())
    .pipe(new Throttle({ rate: frameSize * 30 }))
    .pipe(new ChopStream(frameSize))
    .on("data", (frameData) => {
      if (process.env.USE_COLOR === "true") {
        for (let y = 0; y < frameHeight; y += 1) {
          for (let x = 0; x < frameWidth; x += 1) {
            const offset = (y * frameWidth + x) * 3;
            const r = frameData[offset];
            const g = frameData[offset + 1];
            const b = frameData[offset + 2];

            canvas
              .moveTo(
                x + (canvas.width / 2 - frameWidth / 2),
                y + (canvas.height / 2 - frameHeight / 2)
              )
              .background(`rgb(${r}, ${g}, ${b})`)
              .write(" ");
          }
        }
      } else {
        const contrastFactor = 2.95;

        for (let y = 0; y < frameHeight; y += 1) {
          for (let x = 0; x < frameWidth; x += 1) {
            const offset = (y * frameWidth + x) * 3;
            const r = Math.max(
              0,
              Math.min(contrastFactor * (frameData[offset] - 128) + 128, 255)
            );
            const g = Math.max(
              0,
              Math.min(
                contrastFactor * (frameData[offset + 1] - 128) + 128,
                255
              )
            );
            const b = Math.max(
              0,
              Math.min(
                contrastFactor * (frameData[offset + 2] - 128) + 128,
                255
              )
            );
            const brightness = 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255;

            canvas
              .moveTo(
                x + (canvas.width / 2 - frameWidth / 2),
                y + (canvas.height / 2 - frameHeight / 2)
              )
              .write(CHARACTERS[Math.round(brightness * 14)]);
          }
        }
      }

      canvas.flush();
    });
}

// function playAudio(info) {
//   const audio = info.formats.find(
//     (format) =>
//       format.quality === "tiny" &&
//       format.container === "webm" &&
//       format.audioChannels === 2
//   );

//   const speaker = new Speaker({ channels: 2, sampleRate: 44100 });

//   return ffmpeg(audio.url)
//     .noVideo()
//     .audioCodec("pcm_s16le")
//     .format("s16le")
//     .pipe(speaker);
// }

(async () => {
  const info = await ytdl.getInfo(YOUTUBE_URL);

  playVideo(info);
//   playAudio(info);
})().catch((error) => process.stderr.write(error));

process.on("SIGTERM", () => canvas.restoreScreen());
