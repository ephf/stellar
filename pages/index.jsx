const https = "https://";
// https:// is in a variable because tailwind intellisense extension doesn't work with links in dom
<head>
  <title>Simple View Counter</title>
  <script src={https + "cdn.tailwindcss.com"}></script>
  <link rel="icon" href={https + "img.icons8.com/ios/50/null/telescope.png"} />
</head>;

export default function (req, res) {
  res.state = https;
  return (https) => {
    return (
      <>
        <div class="grid place-items-center h-screen">
          <div class="grid place-items-center gap-40">
            <h3 class="font-medium text-xl">
              <img
                class="inline-block mr-2"
                src={https + "img.icons8.com/ios/20/null/telescope.png"}
              />
              Stellar Testing Grounds
            </h3>
            <p class="p-3 rounded shadow">
              This page has been viewed <Getr src="/api/test" /> time(s)
            </p>
          </div>
        </div>
        <a
          href="https://icons8.com"
          target="_blank"
          class="absolute right-5 bottom-5 p-1 shadow rounded"
        >
          <img
            src={https + "img.icons8.com/color/48/null/icons8-new-logo.png"}
          />
        </a>
      </>
    );
  };
}
