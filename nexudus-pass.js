(function () {
  function loadPass() {
    const coworkerId = window.__nexudus?.auth?.coworker?.Id;

    if (!coworkerId) {
      return false;
    }

    const iframe =
      document.querySelector('iframe.cafe-gardens-pass-frame') ||
      document.querySelector('.cafe-gardens-pass-frame iframe');

    if (!iframe) {
      return false;
    }

    const wantedUrl =
      'https://pass-cafe-gardens.pages.dev/pass?coworkerid=' +
      encodeURIComponent(coworkerId);

    if (iframe.src !== wantedUrl) {
      iframe.src = wantedUrl;
      console.log('Cafe Gardens V5 pass loaded for coworker:', coworkerId);
    }

    return true;
  }

  if (!loadPass()) {
    const timer = setInterval(function () {
      if (loadPass()) {
        clearInterval(timer);
      }
    }, 100);

    setTimeout(function () {
      clearInterval(timer);
    }, 10000);
  }
})();
