insert into assets (id, name, asset_type, status, currency, token_unit, is_synthetic)
values (
  'asset_synthetic_hanriver_01',
  'Han River Office 01',
  'SYNTHETIC_COMMERCIAL_REAL_ESTATE_BENEFICIARY_TOKEN',
  'UNVERIFIED',
  'KRW',
  'TOKEN',
  true
)
on conflict (id) do nothing;
