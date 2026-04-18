function buildActivityPayload() {
  var fd = new FormData(document.getElementById("create-activity-form"));
  var seasonSwitch = document.getElementById("season-switch");
  var seasonEnabled = seasonSwitch.getAttribute("aria-checked") === "true";

  var datesRaw = fd.get("activityDates") || "";
  var dates = datesRaw ? datesRaw.split(",") : [];

  function parseDaysBefore(raw) {
    var m = (raw || "").match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  return {
    game_type:                  fd.get("gameType") || "season",
    title:                      fd.get("activityTitle") || "",
    location:                   fd.get("location") || "",
    dates:                      dates,
    start_time:                 fd.get("activityStartTime") || null,
    end_time:                   fd.get("activityEndTime") || null,
    season_fee_per_session:     Number(fd.get("seasonSingleFee")) || 0,
    pickup_fee_per_session:     Number(fd.get("pickupSingleFee")) || 0,
    ac_fee:                     Number(fd.get("acFee")) || 0,
    single_capacity:            Number(fd.get("singleCapacity")) || 18,
    season_enabled:             seasonEnabled,
    season_include_ac:          fd.get("seasonIncludeAc") === "on",
    season_total_fee:           Number(fd.get("seasonFee")) || 0,
    season_capacity:            fd.get("seasonCapacity") || null,
    season_open_date:           fd.get("seasonOpenDate") || null,
    season_open_time:           fd.get("seasonOpenTime") || null,
    season_deadline_type:       fd.get("seasonDeadlineType") || "unlimited",
    season_close_date:          fd.get("seasonCloseDate") || null,
    season_close_time:          fd.get("seasonCloseTime") || null,
    pickup_open_days_before:    parseDaysBefore(fd.get("pickupOpenDate")),
    pickup_open_time:           fd.get("pickupOpenTime") || null,
    pickup_deadline_type:       fd.get("deadlineType") || "unlimited",
    pickup_close_days_before:   parseDaysBefore(fd.get("pickupCloseDate")),
    pickup_close_time:          fd.get("pickupCloseTime") || null,
  };
}

async function handleCreateActivity(event) {
  event.preventDefault();

  var submitButton = document.querySelector(".submit-button");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "建立中…";
  }

  try {
    var payload = buildActivityPayload();
    await api.createActivity(payload);
    alert("球局建立成功！");
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "./group-list.html";
    }
  } catch (err) {
    alert("建立失敗：" + (err.message || "請稍後再試"));
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "建立球局";
    }
  }
}
