import { nextTick, ref } from 'vue'

const SEASONS_LIST_PAGE_NAME = 'SeasonsListPage'

export const keptAlivePageNames = ref(['ActivitiesListPage', SEASONS_LIST_PAGE_NAME])

export async function clearSeasonsListCache() {
  keptAlivePageNames.value = keptAlivePageNames.value.filter(name => name !== SEASONS_LIST_PAGE_NAME)
  await nextTick()

  if (!keptAlivePageNames.value.includes(SEASONS_LIST_PAGE_NAME)) {
    keptAlivePageNames.value = [...keptAlivePageNames.value, SEASONS_LIST_PAGE_NAME]
  }
}
