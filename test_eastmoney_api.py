import json
import urllib.request
import urllib.error

# Test: EastMoney API data extraction for single stock
# Testing stock: 600497 (驰宏锌锗)

def test_api(url, name, parse_fn=None):
    """Test a single API endpoint and print results."""
    print(f"\n{'='*60}")
    print(f"测试: {name}")
    print(f"URL: {url[:80]}...")
    print(f"{'='*60}")
    
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://quote.eastmoney.com/'
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        
        print(f"Status: rc={data.get('rc')}")
        
        if parse_fn:
            parse_fn(data)
        else:
            # Pretty print first 500 chars
            text = json.dumps(data, ensure_ascii=False, indent=2)
            print(text[:800] + "..." if len(text) > 800 else text)
            
        return data
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.reason}")
        return None
    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")
        return None


def parse_realtime(data):
    """Parse real-time price data."""
    d = data.get('data', {})
    print(f"\n股票基本信息:")
    print(f"  代码: {d.get('f57', 'N/A')}")
    print(f"  名称: {d.get('f58', 'N/A')}")
    print(f"\n价格数据 (原始值,需/100):")
    print(f"  当前价 f43: {d.get('f43', 'N/A')}")
    print(f"  最高价 f44: {d.get('f44', 'N/A')}")
    print(f"  最低价 f45: {d.get('f45', 'N/A')}")
    print(f"  开盘价 f46: {d.get('f46', 'N/A')}")
    print(f"  成交量 f47: {d.get('f47', 'N/A')}")
    print(f"  成交额 f48: {d.get('f48', 'N/A')}")
    print(f"  量比   f50: {d.get('f50', 'N/A')}")
    print(f"  昨收   f60: {d.get('f60', 'N/A')}")
    print(f"  涨跌额 f170: {d.get('f170', 'N/A')}")
    
    # Calculate actual prices
    div100 = lambda v: v/100.0 if isinstance(v, (int, float)) else None
    print(f"\n计算后价格:")
    print(f"  当前价: {div100(d.get('f43'))}")
    print(f"  最高价: {div100(d.get('f44'))}")
    print(f"  最低价: {div100(d.get('f45'))}")
    print(f"  开盘价: {div100(d.get('f46'))}")
    print(f"  昨收:   {div100(d.get('f60'))}")
    print(f"  涨跌额: {div100(d.get('f170'))}")
    
    prev = div100(d.get('f60'))
    cur = div100(d.get('f43'))
    if prev and cur:
        print(f"  涨跌幅: {((cur - prev) / prev * 100):.2f}%")


def parse_kline(data):
    """Parse K-line data."""
    d = data.get('data', {})
    print(f"\nK线数据:")
    print(f"  股票名称: {d.get('name', 'N/A')}")
    print(f"  总K线数 dktotal: {d.get('dktotal', 'N/A')}")
    klines = d.get('klines', [])
    print(f"  返回K线数: {len(klines)}")
    if klines:
        print(f"  最新K线: {klines[0]}")
        print(f"  最旧K线: {klines[-1]}")
        # Parse first kline
        parts = klines[0].split(',')
        print(f"\n  K线字段解析:")
        print(f"    日期: {parts[0]}")
        print(f"    开盘: {parts[1]}")
        print(f"    收盘: {parts[2]}")
        print(f"    最高: {parts[3]}")
        print(f"    最低: {parts[4]}")
        print(f"    成交量: {parts[5]}")
        print(f"    成交额: {parts[6]}")
    else:
        print(f"  ⚠️ K线为空！")


def parse_sector(data):
    """Parse sector/hot sector data."""
    d = data.get('data', {})
    diff = d.get('diff', [])
    print(f"\n板块数据:")
    print(f"  返回条目数: {len(diff)}")
    if diff:
        item = diff[0]
        print(f"\n  第一条:")
        print(f"    f11 类型: {item.get('f11', 'N/A')}")
        print(f"    f12 代码: {item.get('f12', 'N/A')}")
        print(f"    f14 名称: {item.get('f14', 'N/A')}")
        print(f"    f20 市值: {item.get('f20', 'N/A')}")
        print(f"    f33 换手率: {item.get('f33', 'N/A')}")
        print(f"    f34 市盈率: {item.get('f34', 'N/A')}")
        print(f"    f62 主力净流入: {item.get('f62', 'N/A')}")
        print(f"    f104 上涨家数: {item.get('f104', 'N/A')}")
        print(f"    f105 下跌家数: {item.get('f105', 'N/A')}")
        print(f"    f140 领涨股: {item.get('f140', 'N/A')}")
        print(f"    f141 领涨市场: {item.get('f141', 'N/A')}")


def parse_overview(data):
    """Parse market overview data."""
    d = data.get('data', {})
    diff = d.get('diff', [])
    print(f"\n市场概览:")
    print(f"  指数数: {len(diff)}")
    for i, item in enumerate(diff[:4]):
        print(f"\n  指数{i+1}:")
        print(f"    f2 当前价: {item.get('f2', 'N/A')}")
        print(f"    f3 涨跌幅: {item.get('f3', 'N/A')}")
        print(f"    f4 涨跌额: {item.get('f4', 'N/A')}")
        print(f"    f5 成交量: {item.get('f5', 'N/A')}")
        print(f"    f6 成交额: {item.get('f6', 'N/A')}")
        print(f"    f104 上涨: {item.get('f104', 'N/A')}")
        print(f"    f105 下跌: {item.get('f105', 'N/A')}")
        print(f"    f106 平盘: {item.get('f106', 'N/A')}")


# Main tests
print("StockMate EastMoney API 数据抽取测试")
print("测试股票: 600497 (驰宏锌锗)")
print("=" * 60)

# Test 1: Real-time price
url1 = "https://push2.eastmoney.com/api/qt/stock/get?secid=1.600497&fields=f43,f44,f45,f46,f47,f48,f50,f57,f58,f60,f170"
test_api(url1, "个股实时价格", parse_realtime)

# Test 2: K-line (HTTP push2his)
url2 = "http://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.600497&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&end=20500101&lmt=5"
test_api(url2, "个股历史K线 (push2his HTTP)", parse_kline)

# Test 3: K-line (HTTPS push2his)
url3 = "https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.600497&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&end=20500101&lmt=5"
test_api(url3, "个股历史K线 (push2his HTTPS)", parse_kline)

# Test 4: Hot sectors
url4 = "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2&fid=f20&fs=m:90+t:2&fields=f3,f5,f6,f11,f12,f14,f20,f33,f34,f62,f104,f105,f140,f141"
test_api(url4, "热门板块", parse_sector)

# Test 5: Market overview
url5 = "https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f2,f3,f4,f5,f6,f7,f12,f13,f14,f104,f105,f106,f128,f140,f141,f136,f137&secids=1.000001,0.399001,1.000688,0.399006"
test_api(url5, "市场概览", parse_overview)

print("\n" + "=" * 60)
print("测试完成")
