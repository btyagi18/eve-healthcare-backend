INSERT INTO diagnostic_centres (name, location)
VALUES
  ('Apollo Diagnostics', 'Noida'),
  ('Dr Lal PathLabs', 'Delhi')
ON CONFLICT DO NOTHING;

INSERT INTO tests (name, description)
VALUES
  ('CBC', 'Complete Blood Count'),
  ('Vitamin D', 'Vitamin D level test'),
  ('Thyroid Profile', 'Basic thyroid function profile')
ON CONFLICT (name) DO NOTHING;

INSERT INTO centre_tests (centre_id, test_id, price)
SELECT c.id, t.id, x.price
FROM (VALUES
  ('Apollo Diagnostics', 'CBC', 500.00),
  ('Apollo Diagnostics', 'Vitamin D', 800.00),
  ('Apollo Diagnostics', 'Thyroid Profile', 600.00),
  ('Dr Lal PathLabs', 'CBC', 450.00),
  ('Dr Lal PathLabs', 'Vitamin D', 750.00),
  ('Dr Lal PathLabs', 'Thyroid Profile', 550.00)
) AS x(centre_name, test_name, price)
JOIN diagnostic_centres c ON c.name = x.centre_name
JOIN tests t ON t.name = x.test_name
ON CONFLICT (centre_id, test_id) DO NOTHING;
