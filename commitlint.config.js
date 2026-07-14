export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Bot commits (dependabot/release notes) carry long URLs in body/footer.
    "body-max-line-length": [0, "always", 100],
    "footer-max-line-length": [0, "always", 100],
  },
};
