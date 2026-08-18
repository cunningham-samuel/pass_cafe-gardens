export default {
  async scheduled() {
    await fetch(
      'https://pass-cafe-gardens.pages.dev/api/repair-passport-url',
      { method: 'POST' }
    );
  }
};
