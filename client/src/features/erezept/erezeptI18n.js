import { getMessages } from "../../i18n/translations";

export function getErezeptMessages(language) {
  const base = getMessages("en").erezept || {};
  const locale = getMessages(language).erezept || {};

  return {
    ...base,
    ...locale,
    filters: {
      ...(base.filters || {}),
      ...(locale.filters || {}),
    },
    statuses: {
      ...(base.statuses || {}),
      ...(locale.statuses || {}),
    },
  };
}
