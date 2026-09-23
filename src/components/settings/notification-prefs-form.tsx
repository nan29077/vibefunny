"use client";

import { useFormState } from "react-dom";
import { SubmitButton, FormMessage, initialActionState } from "@/components/form";
import { updateNotificationPrefsAction } from "@/lib/actions/settings-actions";
import { NOTIFICATION_CATEGORY_LABELS, type NotificationCategory } from "@/lib/schema";

export function NotificationPrefsForm({ prefs }: { prefs: Partial<Record<NotificationCategory, boolean>> }) {
  const [state, action] = useFormState(updateNotificationPrefsAction, initialActionState);
  const categories = Object.keys(NOTIFICATION_CATEGORY_LABELS) as NotificationCategory[];
  return (
    <form action={action} className="space-y-4">
      {categories.map((c) => (
        <label key={c} className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" name={`pref_${c}`} defaultChecked={prefs[c] !== false} className="mt-0.5 h-4 w-4 rounded" />
          <div>
            <div className="font-semibold text-gray-800">{NOTIFICATION_CATEGORY_LABELS[c].label}</div>
            <div className="text-sm text-gray-500">{NOTIFICATION_CATEGORY_LABELS[c].desc}</div>
          </div>
        </label>
      ))}
      <p className="text-xs text-gray-400">분쟁 접수·분쟁 처리 결과 등 중요한 알림은 설정과 관계없이 항상 발송됩니다.</p>
      <FormMessage state={state} />
      <SubmitButton>저장</SubmitButton>
    </form>
  );
}
