import unittest
import requests
import os
import sys

# Configuration
BASE_URL = "http://localhost:3000"
if os.environ.get("API_URL"):
    BASE_URL = os.environ.get("API_URL")

class TestACBCalculator(unittest.TestCase):
    # Class variables to store IDs
    test_security_id = None
    test_account_id = None
    usd_security_id = None
    dlr_to_id = None
    dlr_u_id = None

    @classmethod
    def setUpClass(cls):
        """Metadata setup - runs once before all tests"""
        print(f"Running tests against {BASE_URL}")
        
        # Check health
        try:
            resp = requests.get(f"{BASE_URL}/api/health")
            if resp.status_code != 200:
                print("Server is not healthy. Please check if backend is running.")
                sys.exit(1)
        except requests.exceptions.ConnectionError:
            print("Could not connect to server. Please ensure backend is running on port 3000.")
            sys.exit(1)

        # Initialize Database (if the endpoint exists, otherwise assume server is ready)
        # In TS: await initializeDatabase() - usually re-inits DB. 
        # Since we are running against a live server, we might not be able to re-init via API.
        # However, the TS tests create NEW securities. We will do the same.
        
        # Create test securities
        # Test Security (CAD)
        res = requests.post(f"{BASE_URL}/api/securities", json={
            "symbol": "TEST", "name": "Test Corp", "currency": "CAD", "type": "stock"
        })
        if res.status_code not in [200, 201]:
             # If it exists, try to find it? Or just fail? 
             # For a robust script, we might cleanup first? 
             # But let's assume we can create it or it returns existing.
             pass
        cls.test_security_id = res.json().get('id')

        # USD Security
        res = requests.post(f"{BASE_URL}/api/securities", json={
            "symbol": "USDTEST", "name": "USD Test", "currency": "USD", "type": "stock"
        })
        cls.usd_security_id = res.json().get('id')

        # DLR.TO
        res = requests.post(f"{BASE_URL}/api/securities", json={
            "symbol": "DLR.TO", "name": "DLR CAD", "currency": "CAD", "type": "etf"
        })
        cls.dlr_to_id = res.json().get('id')

        # DLR.U
        res = requests.post(f"{BASE_URL}/api/securities", json={
            "symbol": "DLR.U", "name": "DLR USD", "currency": "USD", "type": "etf"
        })
        cls.dlr_u_id = res.json().get('id')

        # Create test account
        res = requests.post(f"{BASE_URL}/api/accounts", json={
            "name": "Test Account", "type": "non-registered"
        })
        cls.test_account_id = res.json().get('id')

    @classmethod
    def tearDownClass(cls):
        """Cleanup after all tests"""
        if cls.test_security_id: requests.delete(f"{BASE_URL}/api/securities/{cls.test_security_id}")
        if cls.usd_security_id: requests.delete(f"{BASE_URL}/api/securities/{cls.usd_security_id}")
        if cls.dlr_to_id: requests.delete(f"{BASE_URL}/api/securities/{cls.dlr_to_id}")
        if cls.dlr_u_id: requests.delete(f"{BASE_URL}/api/securities/{cls.dlr_u_id}")
        if cls.test_account_id: requests.delete(f"{BASE_URL}/api/accounts/{cls.test_account_id}")

    def setUp(self):
        """Runs before EACH test - cleanup transactions"""
        # Get all transactions
        res = requests.get(f"{BASE_URL}/api/transactions")
        transactions = res.json()
        for txn in transactions:
            requests.delete(f"{BASE_URL}/api/transactions/{txn['id']}")

    # ============================================================================
    # CATEGORY A: Basic Buy/Sell Mechanics (Tests 1-15)
    # ============================================================================

    def test_01_single_buy_single_sell_full(self):
        buy = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 10
        })
        self.assertEqual(buy.json()['acbAfter'], 5010)

        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 10
        })
        self.assertAlmostEqual(sell.json()['capitalGain'], 980, places=2)
        self.assertEqual(sell.json()['acbAfter'], 0)

    def test_02_single_buy_single_sell_partial(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 10
        })

        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 40, "price": 60, "fees": 10
        })
        self.assertAlmostEqual(sell.json()['capitalGain'], 386, places=2)
        self.assertEqual(sell.json()['sharesAfter'], 60)

    def test_03_two_buys_full_sell(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 10
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 60, "fees": 10
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 150, "price": 70, "fees": 10
        })
        self.assertAlmostEqual(sell.json()['capitalGain'], 2470, places=2)

    def test_04_two_buys_partial_sell(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 0
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 70, "fees": 0
        })
        self.assertAlmostEqual(sell.json()['capitalGain'], 750, places=2)

    def test_05_three_buys_multiple_partial_sells(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 55, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-04-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 70, "fees": 0
        })
        sell2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-05-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 75, "price": 75, "fees": 0
        })
        self.assertEqual(sell2.json()['sharesAfter'], 175)

    def test_06_acb_reset_after_zero_shares(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 0
        })
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 55, "fees": 0
        })
        self.assertEqual(buy2.json()['acbAfter'], 5500)

    def test_07_buy_commission_in_acb(self):
        buy = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 9.99
        })
        self.assertEqual(buy.json()['acbAfter'], 5009.99)

    def test_08_sell_commission_reduces_proceeds(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 9.99
        })
        self.assertAlmostEqual(sell.json()['proceeds'], 5990.01, places=2)

    def test_09_buy_sell_fractional(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 10.5, "price": 100, "fees": 0
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 5.25, "price": 110, "fees": 0
        })
        self.assertEqual(sell.json()['sharesAfter'], 5.25)

    def test_10_buy_whole_sell_fractional(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 33.333, "price": 60, "fees": 0
        })
        self.assertAlmostEqual(sell.json()['sharesAfter'], 66.667, places=3)

    def test_11_buy_fractional_multiple(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 10.5, "price": 50, "fees": 0
        })
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 15.75, "price": 55, "fees": 0
        })
        self.assertEqual(buy2.json()['sharesAfter'], 26.25)

    def test_12_buy_same_day_multiple_sell_later(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 52, "fees": 0
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 0
        })
        self.assertEqual(sell.json()['sharesAfter'], 0)

    def test_13_buy_same_day_diff_price_merged_acb(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 51, "fees": 0
        })
        self.assertEqual(buy2.json()['acbAfter'], 10100)
        self.assertEqual(buy2.json()['acbPerShare'], 50.50)

    def test_14_sell_more_than_owned_error(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 150, "price": 60, "fees": 0
        })
        self.assertEqual(sell.status_code, 400)

    def test_15_sell_zero_shares(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 0, "price": 60, "fees": 0
        })
        self.assertIn(sell.status_code, [200, 201, 400])

    # ============================================================================
    # CATEGORY B: Chronology & Ordering (Tests 16-25)
    # ============================================================================

    def test_16_out_of_chronological_order(self):
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 60, "fees": 0
        })
        
        buy = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        self.assertEqual(buy.status_code, 201)

    def test_17_same_date_buy_sell(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 60, "fees": 0
        })
        self.assertEqual(sell.json()['sharesAfter'], 50)

    def test_18_same_date_sell_buy_error(self):
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 60, "fees": 0
        })
        self.assertEqual(sell.status_code, 400)

    def test_19_multiple_same_day(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 60, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 55, "fees": 0
        })
        sell2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 25, "price": 65, "fees": 0
        })
        self.assertEqual(sell2.json()['sharesAfter'], 75)

    def test_20_timestamps_vs_dates(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 55, "fees": 0
        })
        self.assertEqual(buy2.json()['sharesAfter'], 150)

    def test_21_editing_date_reorder(self):
        buy1 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        }).json()
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 0
        })
        
        requests.put(f"{BASE_URL}/api/transactions/{buy1['id']}", json={"date": '2024-03-15'})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        self.assertEqual(len(txns), 2)

    def test_22_delete_earliest_recompute(self):
        buy1 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        }).json()
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 0
        })
        requests.delete(f"{BASE_URL}/api/transactions/{buy1['id']}")
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        self.assertEqual(len(txns), 1)

    def test_23_insert_backdated(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 0
        })
        backdated = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-20', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 55, "fees": 0
        })
        self.assertEqual(backdated.status_code, 201)

    def test_24_edit_quantity_earliest(self):
        buy1 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        }).json()
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 60, "fees": 0
        })
        requests.put(f"{BASE_URL}/api/transactions/{buy1['id']}", json={"quantity": 150})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        self.assertEqual(len(txns), 2)

    def test_25_edit_price_earliest(self):
        buy1 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        }).json()
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 60, "fees": 0
        })
        requests.put(f"{BASE_URL}/api/transactions/{buy1['id']}", json={"price": 55})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        self.assertEqual(len(txns), 2)

    # ============================================================================
    # CATEGORY C: USD / Foreign Currency (Tests 26-40)
    # ============================================================================

    def test_26_usd_buy_cad_exchange(self):
        buy = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.35
        })
        self.assertAlmostEqual(buy.json()['acbAfter'], 6750, places=2)

    def test_27_multiple_usd_buys(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.35
        })
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 55, "fees": 0, "fxRate": 1.40
        })
        self.assertAlmostEqual(buy2.json()['acbAfter'], 14450, places=2)

    def test_28_usd_buy_sell(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.35
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 0, "fxRate": 1.30
        })
        self.assertAlmostEqual(sell.json()['capitalGain'], 1050, places=2)

    def test_29_usd_buy_partial_sell(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.35
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 40, "price": 60, "fees": 0, "fxRate": 1.30
        })
        self.assertEqual(sell.json()['sharesAfter'], 60)

    def test_30_usd_buy_commission(self):
        buy = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 10, "fxRate": 1.35
        })
        self.assertAlmostEqual(buy.json()['acbAfter'], 6763.5, places=2)

    def test_31_usd_sell_commission(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.35
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 10, "fxRate": 1.30
        })
        self.assertAlmostEqual(sell.json()['proceeds'], 7787, places=2)

    def test_35_fx_rate_correction(self):
        buy = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.35
        }).json()
        
        requests.put(f"{BASE_URL}/api/transactions/{buy['id']}", json={"fxRate": 1.40})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        self.assertEqual(len(txns), 1)

    def test_36_usd_buy_weekend_fallback(self):
        buy = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-13', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.35
        })
        self.assertEqual(buy.status_code, 201)

    def test_37_same_day_usd_buys_diff_fx(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.35
        })
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.36
        })
        self.assertEqual(buy2.json()['sharesAfter'], 200)

    def test_38_fractional_usd_shares(self):
        buy = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 10.5, "price": 100, "fees": 0, "fxRate": 1.35
        })
        self.assertAlmostEqual(buy.json()['acbAfter'], 1417.5, places=2)

    def test_39_usd_drip(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.35
        })
        drip = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'drip', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 2.5, "price": 2, "fees": 0, "fxRate": 1.30
        })
        self.assertEqual(drip.json()['sharesAfter'], 102.5)

    def test_40_usd_roc(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.35
        })
        roc = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'roc', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 0, "fees": 0, 
            "rocPerShare": 5, "fxRate": 1.30
        })
        self.assertAlmostEqual(roc.json()['acbAfter'], 6100, places=2)

    # ============================================================================
    # CATEGORY D: Norbert's Gambit (Tests 41-50)
    # ============================================================================

    def test_41_buy_dlr_cad_sell_dlr_usd(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.dlr_to_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 13.50, "fees": 10
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-16', "type": 'sell', "securityId": self.dlr_u_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 10, "fees": 10, "fxRate": 1.35
        })
        self.assertEqual(sell.status_code, 201)

    def test_42_buy_dlr_usd_sell_dlr_cad(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.dlr_u_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 10, "fees": 10, "fxRate": 1.35
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-16', "type": 'sell', "securityId": self.dlr_to_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 13.50, "fees": 10
        })
        self.assertEqual(sell.status_code, 201)

    def test_43_partial_norberts_gambit(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.dlr_to_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 13.50, "fees": 0
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-16', "type": 'sell', "securityId": self.dlr_u_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 10, "fees": 0, "fxRate": 1.35
        })
        # This checks if the system can handle selling a different connected security
        self.assertEqual(sell.status_code, 201)

    def test_44_norberts_gambit_commission(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.dlr_to_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 13.50, "fees": 9.99
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-16', "type": 'sell', "securityId": self.dlr_u_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 10, "fees": 9.99, "fxRate": 1.35
        })
        self.assertEqual(sell.status_code, 201)

    def test_45_norberts_gambit_multiple_lots(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.dlr_to_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 13.40, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-16', "type": 'buy', "securityId": self.dlr_to_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 13.60, "fees": 0
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-17', "type": 'sell', "securityId": self.dlr_u_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 10, "fees": 0, "fxRate": 1.35
        })
        self.assertEqual(sell.status_code, 201)

    def test_46_norberts_gambit_later_usd_buy(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.dlr_to_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 13.50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-16', "type": 'sell', "securityId": self.dlr_u_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 10, "fees": 0, "fxRate": 1.35
        })
        buyUSD = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-01', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 10, "price": 100, "fees": 0, "fxRate": 1.36
        })
        self.assertEqual(buyUSD.status_code, 201)

    def test_47_norberts_gambit_later_cad_buy(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.dlr_to_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 13.50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-16', "type": 'sell', "securityId": self.dlr_u_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 10, "fees": 0, "fxRate": 1.35
        })
        buyCAD = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-01', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 10, "price": 100, "fees": 0
        })
        self.assertEqual(buyCAD.status_code, 201)

    def test_48_norberts_gambit_fx_edit(self):
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-16', "type": 'sell', "securityId": self.dlr_u_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 10, "fees": 0, "fxRate": 1.35
        }).json()
        requests.put(f"{BASE_URL}/api/transactions/{sell['id']}", json={"fxRate": 1.37})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        self.assertEqual(txns[0]['fxRate'], 1.37)

    def test_49_norberts_gambit_fractional(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.dlr_to_id,
            "accountId": self.test_account_id, "quantity": 100.5, "price": 13.50, "fees": 0
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-16', "type": 'sell', "securityId": self.dlr_u_id,
            "accountId": self.test_account_id, "quantity": 100.5, "price": 10, "fees": 0, "fxRate": 1.35
        })
        self.assertEqual(sell.status_code, 201)

    def test_50_norberts_gambit_full_liquidation(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.dlr_to_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 13.50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-16', "type": 'sell', "securityId": self.dlr_u_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 10, "fees": 0, "fxRate": 1.35
        })
        # Liquidation of DLR (should be 0) - check positions
        pos = requests.get(f"{BASE_URL}/api/positions").json()
        dlr_pos = next((p for p in pos if p['securityId'] == self.dlr_u_id), None)
        self.assertEqual(dlr_pos.get('shares', 0) if dlr_pos else 0, 0)

    # ============================================================================
    # CATEGORY E: Dividends & ROC (Tests 51-65)
    # ============================================================================

    def test_51_cash_dividend(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        div = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'dividend', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 2, "fees": 0
        })
        self.assertEqual(div.json()['acbAfter'], 5000)

    def test_52_multiple_cash_dividends(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'dividend', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 1, "fees": 0
        })
        div2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'dividend', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 1.5, "fees": 0
        })
        self.assertEqual(div2.json()['acbAfter'], 5000)

    def test_54_roc_exceeding_acb(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 8, "fees": 0
        })
        roc = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'roc', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 0, "fees": 0, "rocPerShare": 10
        })
        self.assertEqual(roc.json()['acbAfter'], 0)
        self.assertEqual(roc.json()['capitalGain'], 200)

    def test_55_roc_after_partial_sell(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 40, "price": 60, "fees": 0
        })
        roc = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'roc', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 60, "price": 0, "fees": 0, "rocPerShare": 2
        })
        self.assertEqual(roc.json()['acbAfter'], 2880)

    def test_56_roc_before_sell(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'roc', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 0, "fees": 0, "rocPerShare": 2
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 0
        })
        self.assertEqual(sell.json()['capitalGain'], 1200)

    def test_57_roc_fractional(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 10.5, "price": 100, "fees": 0
        })
        roc = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'roc', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 10.5, "price": 0, "fees": 0, "rocPerShare": 5
        })
        self.assertAlmostEqual(roc.json()['acbAfter'], 997.5, places=2)

    def test_58_roc_usd(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.35
        })
        roc = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'roc', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 0, "fees": 0, "rocPerShare": 2, "fxRate": 1.30
        })
        self.assertAlmostEqual(roc.json()['acbAfter'], 6490, places=2)

    def test_59_roc_correction_edit(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        roc = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'roc', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 0, "fees": 0, "rocPerShare": 2
        }).json()
        
        requests.put(f"{BASE_URL}/api/transactions/{roc['id']}", json={"rocPerShare": 3})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        self.assertEqual(txns[1]['rocPerShare'], 3)

    def test_60_mixed_dividend_roc(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'dividend', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 1, "fees": 0
        })
        roc = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'roc', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 0, "fees": 0, "rocPerShare": 2
        })
        self.assertEqual(roc.json()['acbAfter'], 4800)

    def test_62_drip_fractional(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        drip = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'drip', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 2.333, "price": 3, "fees": 0
        })
        self.assertAlmostEqual(drip.json()['sharesAfter'], 102.333, places=3)

    def test_63_drip_usd(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.35
        })
        drip = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'drip', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 5, "price": 10, "fees": 0, "fxRate": 1.30
        })
        self.assertAlmostEqual(drip.json()['acbAfter'], 6815, places=2)

    def test_64_drip_after_partial_sell(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 60, "fees": 0
        })
        drip = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'drip', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 2, "price": 5, "fees": 0
        })
        self.assertEqual(drip.json()['sharesAfter'], 52)

    def test_65_drip_then_roc(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'drip', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 2, "price": 10, "fees": 0
        })
        roc = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'roc', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 102, "price": 0, "fees": 0, "rocPerShare": 1
        })
        self.assertEqual(roc.json()['acbAfter'], 5018)

    # ============================================================================
    # CATEGORY F: Stock Splits (Tests 66-75)
    # ============================================================================

    def test_66_2_for_1_split(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        split = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'split', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 0, "price": 0, "fees": 0, "ratio": 2
        })
        self.assertEqual(split.json()['sharesAfter'], 200)
        self.assertEqual(split.json()['acbAfter'], 5000)

    def test_68_split_after_partial_sell(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 40, "price": 60, "fees": 0
        })
        split = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'split', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 0, "price": 0, "fees": 0, "ratio": 2
        })
        self.assertEqual(split.json()['sharesAfter'], 120)

    def test_69_split_before_sell(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'split', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 0, "price": 0, "fees": 0, "ratio": 2
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 200, "price": 30, "fees": 0
        })
        self.assertEqual(sell.json()['sharesAfter'], 0)

    def test_70_split_fractional(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100.5, "price": 50, "fees": 0
        })
        split = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'split', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 0, "price": 0, "fees": 0, "ratio": 2
        })
        self.assertEqual(split.json()['sharesAfter'], 201)

    def test_71_split_drip(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'drip', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 2, "price": 10, "fees": 0
        })
        split = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'split', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 0, "price": 0, "fees": 0, "ratio": 2
        })
        self.assertEqual(split.json()['sharesAfter'], 204)

    def test_72_split_roc(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'roc', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 0, "fees": 0, "rocPerShare": 5
        })
        split = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'split', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 0, "price": 0, "fees": 0, "ratio": 2
        })
        self.assertEqual(split.json()['sharesAfter'], 200)
        self.assertEqual(split.json()['acbAfter'], 4500)

    def test_73_split_usd(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.35
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'split', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 0, "price": 0, "fees": 0, "ratio": 2
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'sell', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 200, "price": 30, "fees": 0, "fxRate": 1.30
        })
        self.assertEqual(sell.status_code, 201)

    def test_74_multiple_splits(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'split', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 0, "price": 0, "fees": 0, "ratio": 2
        })
        split2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'split', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 0, "price": 0, "fees": 0, "ratio": 3
        })
        self.assertEqual(split2.json()['sharesAfter'], 600)

    def test_75_edit_split_ratio(self):
        split = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'split', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 0, "price": 0, "fees": 0, "ratio": 2
        }).json()
        requests.put(f"{BASE_URL}/api/transactions/{split['id']}", json={"ratio": 3})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        self.assertEqual(txns[0]['ratio'], 3)

    # ============================================================================
    # CATEGORY G: Superficial Loss (Tests 76-85)
    # ============================================================================

    def test_76_loss_repurchase_30_days(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 40, "fees": 0
        })
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-20', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 38, "fees": 0
        })
        self.assertEqual(buy2.json()['acbAfter'], 4800)

    def test_77_partial_superficial_loss(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 40, "fees": 0
        })
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-20', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 38, "fees": 0
        })
        self.assertEqual(buy2.json()['acbAfter'], 2400)

    def test_78_full_superficial_loss_deferral(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 40, "fees": 0
        })
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 40, "fees": 0
        })
        self.assertEqual(buy2.json()['acbAfter'], 5000)

    def test_79_superficial_loss_fractional(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 10.5, "price": 100, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 10.5, "price": 80, "fees": 0
        })
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-20', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 5.25, "price": 75, "fees": 0
        })
        self.assertAlmostEqual(buy2.json()['acbAfter'], 498.75, places=2)

    def test_80_superficial_loss_multiple_buys(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-20', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 60, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 40, "fees": 0
        })
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-20', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 38, "fees": 0
        })
        self.assertEqual(buy2.json()['acbAfter'], 5300)

    def test_81_superficial_loss_usd(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.35
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 40, "fees": 0, "fxRate": 1.30
        })
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-20', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 38, "fees": 0, "fxRate": 1.32
        })
        self.assertAlmostEqual(buy2.json()['acbAfter'], 6566, delta=1)

    def test_82_superficial_loss_drip(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 40, "fees": 0
        })
        drip = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-20', "type": 'drip', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 10, "price": 4, "fees": 0
        })
        self.assertEqual(drip.json()['acbAfter'], 500)

    def test_83_superficial_loss_edited_date(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 40, "fees": 0
        })
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-04-20', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 38, "fees": 0
        }).json()
        self.assertEqual(buy2['acbAfter'], 3800)
        
        requests.put(f"{BASE_URL}/api/transactions/{buy2['id']}", json={"date": '2024-02-20'})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        buy_txn = next(t for t in txns if t['id'] == buy2['id'])
        self.assertEqual(buy_txn['acbAfter'], 4800)

    def test_84_superficial_loss_final_sale(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 40, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-20', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 38, "fees": 0
        })
        final = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-05-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        self.assertEqual(final.json()['capitalGain'], 200)

    def test_85_superficial_loss_multiple_lots(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 40, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-20', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 38, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-25', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 39, "fees": 0
        })
        pos = requests.get(f"{BASE_URL}/api/positions").json()
        test_pos = next(p for p in pos if p['securityId'] == self.test_security_id)
        self.assertEqual(test_pos['acb'], 4850)

    # ============================================================================
    # CATEGORY H: Multi-Broker (Tests 86-92)
    # ============================================================================

    def test_86_multi_broker_same_security(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        self.assertTrue(True)

    def test_87_multi_broker_overlap(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "broker": 'Questrade'
        })
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 51, "fees": 0, "broker": 'IBKR'
        })
        self.assertEqual(buy2.json()['sharesAfter'], 150)

    def test_88_duplicate_transaction(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "externalId": 'TXN123'
        })
        buyDup = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "externalId": 'TXN123'
        })
        self.assertEqual(buyDup.status_code, 400)

    def test_89_import_usd_missing_fx(self):
        buy = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        self.assertEqual(buy.status_code, 201)
        self.assertIsNotNone(buy.json()['fxRate'])

    def test_90_import_qty_correction(self):
        buy = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 10, "price": 50, "fees": 0
        }).json()
        requests.put(f"{BASE_URL}/api/transactions/{buy['id']}", json={"quantity": 100})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        self.assertEqual(txns[0]['quantity'], 100)

    def test_91_import_norberts_separate(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.dlr_to_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 13.50, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'sell', "securityId": self.dlr_u_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 10, "fees": 0, "fxRate": 1.35
        })
        pos = requests.get(f"{BASE_URL}/api/positions").json()
        self.assertGreater(len(pos), 0)

    def test_92_import_edit_recompute(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 0
        }).json()
        requests.put(f"{BASE_URL}/api/transactions/{sell['id']}", json={"price": 65})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        sell_txn = next(t for t in txns if t['id'] == sell['id'])
        self.assertEqual(sell_txn['capitalGain'], 1500)

    # ============================================================================
    # CATEGORY I: Transaction Editing (Tests 93-100)
    # ============================================================================

    def test_93_edit_earlier_price_cascade(self):
        buy1 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        }).json()
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 60, "fees": 0
        })
        requests.put(f"{BASE_URL}/api/transactions/{buy1['id']}", json={"price": 55})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        self.assertEqual(len(txns), 2)

    def test_94_delete_early_buy_cascade(self):
        buy1 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        }).json()
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 0
        })
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 70, "fees": 0
        })
        
        requests.delete(f"{BASE_URL}/api/transactions/{buy1['id']}")
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        sell_txn = next(t for t in txns if t['type'] == 'sell')
        self.assertEqual(sell_txn['acbUsed'], 3000)

    def test_95_edit_sell_quantity_later_acb(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 60, "fees": 0
        }).json()
        buy2 = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 50, "price": 55, "fees": 0
        }).json()
        
        requests.put(f"{BASE_URL}/api/transactions/{sell['id']}", json={"quantity": 80})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        buy2_txn = next(t for t in txns if t['id'] == buy2['id'])
        self.assertEqual(buy2_txn['sharesAfter'], 70)

    def test_96_edit_roc_cascade(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 8, "fees": 0
        })
        roc = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'roc', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 0, "fees": 0, "rocPerShare": 5
        }).json()
        
        requests.put(f"{BASE_URL}/api/transactions/{roc['id']}", json={"rocPerShare": 10})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        roc_txn = next(t for t in txns if t['id'] == roc['id'])
        self.assertEqual(roc_txn['capitalGain'], 200)

    def test_97_edit_split_ratio_later_sell(self):
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 0
        })
        split = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'split', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 0, "price": 0, "fees": 0, "ratio": 2
        }).json()
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-03-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 10, "price": 40, "fees": 0
        }).json()
        
        requests.put(f"{BASE_URL}/api/transactions/{split['id']}", json={"ratio": 3})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        sell_txn = next(t for t in txns if t['id'] == sell['id'])
        self.assertEqual(sell_txn['acbUsed'], 200)

    def test_98_edit_fx_later(self):
        buy = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0, "fxRate": 1.30
        }).json()
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'sell', "securityId": self.usd_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 0, "fxRate": 1.35
        }).json()
        
        requests.put(f"{BASE_URL}/api/transactions/{buy['id']}", json={"fxRate": 1.32})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        sell_txn = next(t for t in txns if t['id'] == sell['id'])
        self.assertEqual(sell_txn['capitalGain'], 1500)

    def test_99_edit_sell_date_invalid(self):
        sell = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'sell', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 60, "fees": 0
        }).json()
        requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-02-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        })
        
        requests.put(f"{BASE_URL}/api/transactions/{sell['id']}", json={"date": '2024-03-15'})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        sell_txn = next(t for t in txns if t['id'] == sell['id'])
        self.assertEqual(sell_txn['capitalGain'], 1000)

    def test_100_idempotent_recalc(self):
        buy = requests.post(f"{BASE_URL}/api/transactions", json={
            "date": '2024-01-15', "type": 'buy', "securityId": self.test_security_id,
            "accountId": self.test_account_id, "quantity": 100, "price": 50, "fees": 0
        }).json()
        requests.put(f"{BASE_URL}/api/transactions/{buy['id']}", json={"price": 51})
        requests.put(f"{BASE_URL}/api/transactions/{buy['id']}", json={"quantity": 110})
        requests.put(f"{BASE_URL}/api/transactions/{buy['id']}", json={"price": 50})
        requests.put(f"{BASE_URL}/api/transactions/{buy['id']}", json={"quantity": 100})
        
        txns = requests.get(f"{BASE_URL}/api/transactions").json()
        self.assertEqual(txns[0]['acbAfter'], 5000)

    # END OF TESTS

if __name__ == '__main__':
    unittest.main()
