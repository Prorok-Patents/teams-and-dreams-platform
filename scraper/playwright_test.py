import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        try:
            print("Navigating...")
            response = await page.goto('https://eventor.orienteering.sport/Events', wait_until='domcontentloaded')
            print(f"Status: {response.status}")
            await page.screenshot(path='screenshot.png')
            content = await page.content()
            with open('page.html', 'w', encoding='utf-8') as f:
                f.write(content)
            print("Done")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
