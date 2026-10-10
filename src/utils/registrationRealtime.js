export function isRelevantRegistrationChange(change, { selectedDateId = null, seasonOnly = false, guest = false } = {}) {
  const affectedDateIds = [change.new?.activity_date_id, change.old?.activity_date_id].filter(dateId => dateId !== undefined)

  // DELETE events may contain only the primary key. Refresh when the date cannot be identified.
  if (!affectedDateIds.length) return true
  if (seasonOnly) return affectedDateIds.some(dateId => dateId === null)
  if (selectedDateId == null) return true

  return affectedDateIds.some(dateId => (!guest && dateId === null) || String(dateId) === String(selectedDateId))
}
