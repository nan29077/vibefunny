"use client";

import { useFormState } from "react-dom";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton, FormMessage, FieldError, initialActionState } from "@/components/form";
import { createProductAction } from "@/lib/actions/commerce-actions";
import type { CategoryNode } from "@/lib/commerce";

export function AdminProductForm({
  categoryTree,
  defaultCommission,
  cafe24Configured,
}: {
  categoryTree: CategoryNode[];
  defaultCommission: number;
  cafe24Configured: boolean;
}) {
  const [state, action] = useFormState(createProductAction, initialActionState);

  return (
    <form action={action} className="space-y-6">
      {/* 기본 정보 */}
      <Card>
        <h2 className="mb-4 text-base font-bold">기본 정보</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="상품명" required className="sm:col-span-2">
            <Input name="name" placeholder="예: 데일리 수분 세럼 50ml" required />
            <FieldError state={state} name="name" />
          </Field>
          <Field label="상품코드" hint="비우면 자동 생성됩니다 (카페24 custom_product_code)">
            <Input name="product_code" placeholder="예: VF-BTY-0001" />
          </Field>
          <Field label="카테고리">
            <Select name="category_id" defaultValue="">
              <option value="">선택 안 함</option>
              {categoryTree.map((major) => (
                <optgroup key={major.id} label={major.name}>
                  <option value={major.id}>{major.name} (대분류)</option>
                  {major.children.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {major.name} &gt; {sub.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="브랜드">
            <Input name="brand" placeholder="예: 글로우랩" />
          </Field>
          <Field label="제조사">
            <Input name="manufacturer" placeholder="예: 글로우랩" />
          </Field>
          <Field label="원산지">
            <Input name="origin" placeholder="예: 대한민국" />
          </Field>
          <Field label="모델명">
            <Input name="model_name" placeholder="예: GL-SR-50" />
          </Field>
        </div>
      </Card>

      {/* 판매 정보 */}
      <Card>
        <h2 className="mb-4 text-base font-bold">판매 정보</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="소비자가(정가)" hint="원">
            <Input type="number" name="retail_price" min={0} defaultValue={0} />
          </Field>
          <Field label="판매가" required hint="원">
            <Input type="number" name="price" min={0} defaultValue={0} required />
            <FieldError state={state} name="price" />
          </Field>
          <Field label="공급가" hint="원">
            <Input type="number" name="supply_price" min={0} defaultValue={0} />
          </Field>
          <Field label="재고 수량">
            <Input type="number" name="stock" min={0} defaultValue={0} />
          </Field>
          <Field label="크리에이터 판매 수수료율" hint="쇼츠 판매 시 크리에이터 적립 %">
            <Input type="number" name="commission_rate" min={0} max={90} defaultValue={defaultCommission} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="옵션명" hint="예: 색상 / 사이즈 (선택)">
            <Input name="option_name" placeholder="예: 색상" />
          </Field>
          <Field label="옵션값" hint="쉼표로 구분 — 예: 블랙,화이트,핑크">
            <Input name="option_values" placeholder="블랙,화이트,핑크" />
          </Field>
        </div>
      </Card>

      {/* 상세 설명 & 이미지 */}
      <Card>
        <h2 className="mb-4 text-base font-bold">상세 설명 &amp; 이미지</h2>
        <div className="space-y-4">
          <Field label="상품 요약설명">
            <Input name="summary" placeholder="한 줄 요약 (목록/추천에 노출)" />
          </Field>
          <Field label="상세 설명">
            <Textarea name="description" rows={6} placeholder="상품 상세 설명 (HTML/텍스트)" />
          </Field>
          <Field label="대표 이미지 URL">
            <Input name="main_image_url" placeholder="https://..." />
          </Field>
          <Field label="추가 이미지 URL" hint="한 줄에 하나씩 또는 쉼표로 구분">
            <Textarea name="additional_image_urls" rows={2} placeholder="https://image1.jpg, https://image2.jpg" />
          </Field>
          <Field label="검색어/태그" hint="쉼표로 구분 — 쇼츠 추천 매칭에 사용됩니다">
            <Input name="keywords" placeholder="수분,세럼,스킨케어,뷰티" />
          </Field>
        </div>
      </Card>

      {/* 배송 정보 */}
      <Card>
        <h2 className="mb-4 text-base font-bold">배송 정보</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="배송비 유형">
            <Select name="shipping_fee_type" defaultValue="conditional">
              <option value="free">무료배송</option>
              <option value="fixed">유료배송(고정)</option>
              <option value="conditional">조건부무료</option>
            </Select>
          </Field>
          <Field label="배송비" hint="원">
            <Input type="number" name="shipping_fee" min={0} defaultValue={3000} />
          </Field>
          <Field label="배송 안내">
            <Input name="shipping_info" placeholder="예: 3만원 이상 무료배송" />
          </Field>
        </div>
      </Card>

      {/* 진열/판매 상태 + 카페24 */}
      <Card>
        <h2 className="mb-4 text-base font-bold">진열 / 판매 / 카페24 연동</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="진열 상태">
            <Select name="display_status" defaultValue="displayed">
              <option value="displayed">진열함</option>
              <option value="hidden">진열안함</option>
            </Select>
          </Field>
          <Field label="판매 상태">
            <Select name="sell_status" defaultValue="selling">
              <option value="selling">판매함</option>
              <option value="stopped">판매안함</option>
              <option value="soldout">품절</option>
            </Select>
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="sync_cafe24" defaultChecked className="h-4 w-4 rounded border-gray-300" />
          등록과 동시에 카페24에 연동
          <span className={cafe24Configured ? "text-green-600" : "text-gray-400"}>
            ({cafe24Configured ? "실제 연동 활성화됨" : "미리보기 모드 — 키 미설정"})
          </span>
        </label>
      </Card>

      <div className="flex items-center gap-3">
        <SubmitButton size="lg">상품 등록</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
