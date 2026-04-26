const appJson = require('./app.json');

module.exports = ({ config }) => {
  const appJsonExpo = appJson?.expo ?? {};
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    appJsonExpo?.extra?.eas?.projectId ??
    undefined;
  const owner = process.env.EXPO_OWNER ?? appJsonExpo?.owner ?? undefined;
  const base = {
    ...config,
    ...appJsonExpo,
    owner,
    extra: {
      ...(config.extra ?? {}),
      ...(appJsonExpo.extra ?? {}),
    },
  };

  return {
    ...base,
    extra: {
      ...(base.extra ?? {}),
      openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? null,
      eas: projectId
        ? {
            ...(base.extra?.eas ?? {}),
            projectId,
          }
        : {
            ...(base.extra?.eas ?? {}),
          },
    },
  };
};
