import httpx
import asyncio

async def test():
    async with httpx.AsyncClient() as client:
        # just try to hit CNMS root
        try:
            res = await client.get("http://127.0.0.1:8001/tickets/", timeout=5)
            print("Status:", res.status_code)
            data = res.json()
            if "tickets" in data:
                print("Found", len(data["tickets"]), "tickets")
                if data["tickets"]:
                    print("Sample ticket:", data["tickets"][0])
        except Exception as e:
            print("Error connecting:", e)

asyncio.run(test())
