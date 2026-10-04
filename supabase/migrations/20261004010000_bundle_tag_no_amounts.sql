-- Bundle tags are labels only ("MOST POPULAR"). The multi-buy saving ("Save extra ₦4,000") is computed
-- from live prices in the UI (bundleExtraSavingKobo), so typed amounts never drift from real prices
-- (honesty rule §0.8). Strip any amount that was typed into existing tags.
update public.bundles
   set tag = nullif(btrim(regexp_replace(tag, '\s*[•·|-]?\s*save\s+(extra\s+)?₦\s*[0-9][0-9,]*', '', 'gi')), '')
 where tag ~* 'save\s+(extra\s+)?₦\s*[0-9]';

comment on column public.bundles.tag is 'Label only, e.g. "MOST POPULAR". Never type prices or savings here: the UI computes the multi-buy saving from live prices.';
