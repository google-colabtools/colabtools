import { Page } from 'rebrowser-playwright'
import readline from 'readline'
import * as crypto from 'crypto'
import { AxiosRequestConfig } from 'axios'

import { MicrosoftRewardsBot } from '../index'
import { saveSessionData } from '../util/Load'

import { OAuth } from '../interface/OAuth'


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

export class Login {
    private bot: MicrosoftRewardsBot
    private clientId: string = '0000000040170455'
    private authBaseUrl: string = 'https://login.live.com/oauth20_authorize.srf'
    private redirectUrl: string = 'https://login.live.com/oauth20_desktop.srf'
    private tokenUrl: string = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
    private scope: string = 'service::prod.rewardsplatform.microsoft.com::MBI_SSL'

    constructor(bot: MicrosoftRewardsBot) {
        this.bot = bot
    }

    async login(page: Page, email: string, password: string) {
        const maxRetries = 1;
        const retryDelay = 30000; // 30 seconds
        let lastError: any;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Navigate to the Bing login page
                await page.goto('https://rewards.bing.com/signin')

                await page.waitForLoadState('domcontentloaded').catch(() => { })

                await this.bot.browser.utils.reloadBadPage(page)

                // Check if account is locked
                await this.checkAccountLocked(page)

                // After any login step where the button may appear, add:
                const skipButton = await page.$('button[data-testid="secondaryButton"]');
                if (skipButton) {
                    await skipButton.click();
                    this.bot.log(this.bot.isMobile, 'LOGIN', '"Skip for now" button clicked successfully');
                    await this.bot.utils.wait(5000); // Wait a bit after clicking
                    await page.goto('https://rewards.bing.com/signin')
                    await page.waitForLoadState('domcontentloaded').catch(() => { })
                    await this.bot.browser.utils.reloadBadPage(page)
                }

                const isLoggedInTest = await page.waitForSelector('html[data-role-name="RewardsPortal"]', { timeout: 10000 }).then(() => true).catch(() => false)

                if (!isLoggedInTest) {
                    await page.goto('https://rewards.bing.com/signin')
                    await page.waitForLoadState('domcontentloaded').catch(() => { })
                    await this.bot.browser.utils.reloadBadPage(page)
                    // Check if account is locked
                    await this.checkAccountLocked(page)
                }
                
                const isLoggedIn = await page.waitForSelector('html[data-role-name="RewardsPortal"]', { timeout: 10000 }).then(() => true).catch(() => false)
                if (!isLoggedIn) {
                    await this.execLogin(page, email, password)
                    this.bot.log(this.bot.isMobile, 'LOGIN', 'Logged into Microsoft successfully')
                } else {
                    this.bot.log(this.bot.isMobile, 'LOGIN', 'Already logged in')

                    // Check if account is locked
                    await this.checkAccountLocked(page);

                    const isLoggedIn = await page.waitForSelector('html[data-role-name="RewardsPortal"]', { timeout: 10_000 })
                        .then(() => true)
                        .catch(() => false);

                    if (!isLoggedIn) {
                        await this.execLogin(page, email, password);
                        this.bot.log(this.bot.isMobile, 'LOGIN', 'Logged into Microsoft successfully');
                    } else {
                        this.bot.log(this.bot.isMobile, 'LOGIN', 'Already logged in');
                        await this.checkAccountLocked(page);
                    }
                }

                // Check if logged in to bing
                await this.checkBingLogin(page);

                // Save session
                await saveSessionData(this.bot.config.sessionPath, page.context(), email, this.bot.isMobile);

                // We're done logging in
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Logged in successfully, saved login session!');
                return; // 成功后直接返回

            } catch (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    this.bot.log(
                        this.bot.isMobile, 
                        'LOGIN', 
                        `Login attempt ${attempt} failed: ${error}. Retrying in ${retryDelay/1000}s...`, 
                        'warn'
                    );
                    // 重试前等待
                    await this.bot.utils.wait(retryDelay);
                    
                    // 尝试清理页面状态
                    try {
                        await page.reload({ waitUntil: 'domcontentloaded' });
                    } catch (e) {
                        // 忽略重载错误
                    }
                }
            }
        }

        // 所有重试都失败了，抛出最后一个错误
        throw this.bot.log(this.bot.isMobile, 'LOGIN', `Failed after ${maxRetries} attempts. Last error: ${lastError}`, 'error');
    }

    private async execLogin(page: Page, email: string, password: string) {
        try {
            await this.enterEmail(page, email)
            await this.bot.utils.wait(2000)
            await this.bot.browser.utils.reloadBadPage(page)
            await this.bot.utils.wait(2000)
            await this.enterPassword(page, password)
            await this.bot.utils.wait(2000)

            // Check if account is locked
            await this.checkAccountLocked(page)

            await this.bot.browser.utils.reloadBadPage(page)
            await this.checkLoggedIn(page)
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'LOGIN', 'An error occurred: ' + error, 'error')
        }
    }

    private async enterEmail(page: Page, email: string) {
        const emailInputSelector = 'input[type="email"]'
    
        try {   

            const isLoggedInTest = await page.waitForSelector('html[data-role-name="RewardsPortal"]', { timeout: 10000 }).then(() => true).catch(() => false)

            if (!isLoggedInTest) {
                await page.goto('https://rewards.bing.com/signin')
                await page.waitForLoadState('domcontentloaded').catch(() => { })
                await this.bot.browser.utils.reloadBadPage(page)
                // Check if account is locked
                await this.checkAccountLocked(page)
            }            
            // Verifica se já está logado antes de qualquer ação
            const alreadyLoggedIn = await page.$('html[data-role-name="RewardsPortal"]')
            if (alreadyLoggedIn) {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Detected already logged in (via RewardsPortal selector). Skipping email entry.')
                return
            }
            
            // Wait for email field
            const emailField = await page.waitForSelector(emailInputSelector, { state: 'visible', timeout: 2000 }).catch(() => null)
            if (!emailField) {
                //screenshot
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); 
                const screenshotPath = `./email_field_${timestamp}.png`;
                await page.screenshot({ path: screenshotPath });

                this.bot.log(this.bot.isMobile, 'LOGIN', 'Email field not found', 'warn')
                //throw new Error('Email field not found');
                return
            }
            
            await this.bot.utils.wait(1000)
    
            // Check if email is prefilled
            const emailPrefilled = await page.waitForSelector('#userDisplayName', { timeout: 5000 }).catch(() => null)
            if (emailPrefilled) {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Email already prefilled by Microsoft')
            } else {
                // Else clear and fill email
                await page.fill(emailInputSelector, '')
                await this.bot.utils.wait(500)
                await page.fill(emailInputSelector, email)
                await this.bot.utils.wait(1000)
            }
    
            const nextButton = await page.waitForSelector('button[type="submit"]', { timeout: 2000 }).catch(() => null)
            if (nextButton) {
                await nextButton.click()
                await this.bot.utils.wait(2000)
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Email entered successfully')
            } else {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Next button not found after email entry', 'warn')
            }
    
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'LOGIN', `Email entry failed: ${error}`, 'error')
            // Lança novamente para garantir que suba até login()
            throw error
        }
    }

    private async enterPassword(page: Page, password: string) {
        const passwordInputSelector = 'input[type="password"]'
        
        try {
            const alreadyLoggedIn = await page.$('html[data-role-name="RewardsPortal"]')
            if (alreadyLoggedIn) {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Detected already logged in (via RewardsPortal selector). Skipping password entry.')
                return
            }
            const UsePasswordButton = await page.$('span[role="button"]:has-text("Use your password")');
            if (UsePasswordButton) {
                await UsePasswordButton.click();
                this.bot.log(this.bot.isMobile, 'LOGIN', '"Use your password" button clicked successfully');
            }

            await this.bot.utils.wait(5000)

            const passwordField = await page.waitForSelector(passwordInputSelector, { state: 'visible', timeout: 5000 }).catch(() => null)
            if (!passwordField) {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Password field not found, possibly 2FA required', 'warn')
                await this.handle2FA(page)
                return
            }

            await this.bot.utils.wait(1000)

            // Clear and fill password
            await page.fill(passwordInputSelector, '')
            await this.bot.utils.wait(500)
            await page.fill(passwordInputSelector, password)
            await this.bot.utils.wait(1000)

            const nextButton = await page.waitForSelector('button[type="submit"]', { timeout: 2000 }).catch(() => null)
            if (nextButton) {
                await nextButton.click()
                await this.bot.utils.wait(1000)
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); 
                const screenshotPath = `./password_enter_${timestamp}.png`;
                await page.screenshot({ path: screenshotPath });
                await this.bot.utils.wait(3000)
                // Get the plain text content of the body
                const helptext = await page.evaluate(() => document.body.innerText.trim());
                // Check if the text contains "Help us protect your account"
                if (helptext.includes('Help us protect your account')) {
                    console.error('ERROR: The page returned "Help us protect your account". Exiting.');
                    await page.close();
                    process.exit(1); // Critical error, stop the script
                }
                // After any login step where the button may appear, add:
                let skipButtonFound = false;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    const skipButton = await page.$('button[data-testid="secondaryButton"]');
                    if (skipButton) {
                        skipButtonFound = true;
                        await skipButton.click();
                        this.bot.log(this.bot.isMobile, 'LOGIN', `"Skip for now" button found and clicked (attempt ${attempt}).`);
                        await this.bot.utils.wait(5000); // Espera antes de tentar novamente
                    } else if (!skipButtonFound) {
                        this.bot.log(this.bot.isMobile, 'LOGIN', `"Skip for now" button not found on first attempt, stopping further attempts.`);
                        break;
                    } else {
                        this.bot.log(this.bot.isMobile, 'LOGIN', `"No more 'Skip for now' button found after ${attempt - 1} clicks. Stopping.`);
                        break;
                    }
                }                

                // Get the plain text content of the body
                const bodyText = await page.evaluate(() => document.body.innerText.trim());

                // Check if the text contains "Too Many Requests"
                if (bodyText.includes('Too Many Requests')) {
                    console.error('ERROR: The page returned "Too Many Requests". Exiting.');
                    await page.close();
                    process.exit(1); // Critical error, stop the script
                } else {
                    console.log('The page loaded successfully.');
                }
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Password entered successfully')
            } else {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Next button not found after password entry', 'warn')
            }

        } catch (error) {
            this.bot.log(this.bot.isMobile, 'LOGIN', `Password entry failed: ${error}`, 'error')
            await this.handle2FA(page)
        }
    }

    private async handle2FA(page: Page) {
        try {
            const numberToPress = await this.get2FACode(page)
            if (numberToPress) {
                // Authentictor App verification
                await this.authAppVerification(page, numberToPress)
            } else {
                // SMS verification
                await this.authSMSVerification(page)
            }
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'LOGIN', `2FA handling failed: ${error}`)
        }
    }

    private async get2FACode(page: Page): Promise<string | null> {
        try {
            const element = await page.waitForSelector('#displaySign, div[data-testid="displaySign"]>span', { state: 'visible', timeout: 2000 })
            return await element.textContent()
        } catch {
            if (this.bot.config.parallel) {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Script running in parallel, can only send 1 2FA request per account at a time!', 'log', 'yellow')
                this.bot.log(this.bot.isMobile, 'LOGIN', 'Trying again in 60 seconds! Please wait...', 'log', 'yellow')

                // eslint-disable-next-line no-constant-condition
                while (true) {
                    const button = await page.waitForSelector('button[aria-describedby="pushNotificationsTitle errorDescription"]', { state: 'visible', timeout: 2000 }).catch(() => null)
                    if (button) {
                        await this.bot.utils.wait(60000)
                        await button.click()

                        continue
                    } else {
                        break
                    }
                }
            }

            await page.click('button[aria-describedby="confirmSendTitle"]').catch(() => { })
            await this.bot.utils.wait(2000)
            const element = await page.waitForSelector('#displaySign, div[data-testid="displaySign"]>span', { state: 'visible', timeout: 2000 })
            return await element.textContent()
        }
    }

    private async authAppVerification(page: Page, numberToPress: string | null) {
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                this.bot.log(this.bot.isMobile, 'LOGIN', `Press the number ${numberToPress} on your Authenticator app to approve the login`)
                this.bot.log(this.bot.isMobile, 'LOGIN', 'If you press the wrong number or the "DENY" button, try again in 60 seconds')

                await page.waitForSelector('form[name="f1"]', { state: 'detached', timeout: 60000 })

                this.bot.log(this.bot.isMobile, 'LOGIN', 'Login successfully approved!')
                break
            } catch {
                this.bot.log(this.bot.isMobile, 'LOGIN', 'The code is expired. Trying to get a new code...')
                await page.click('button[aria-describedby="pushNotificationsTitle errorDescription"]')
                numberToPress = await this.get2FACode(page)
            }
        }
    }

    private async authSMSVerification(page: Page) {
        this.bot.log(this.bot.isMobile, 'LOGIN', 'SMS 2FA code required. Waiting for user input...')

        const code = await new Promise<string>((resolve) => {
            rl.question('Enter 2FA code:\n', (input: string | PromiseLike<string>) => {
                rl.close()
                resolve(input)
            })
        })

        await page.fill('input[name="otc"]', code)
        await page.keyboard.press('Enter')
        this.bot.log(this.bot.isMobile, 'LOGIN', '2FA code entered successfully')
    }

    private async checkLoggedIn(page: Page) {
        const targetHostname = 'rewards.bing.com'
        const targetPathname = '/'

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const skipButton = await page.$('button[data-testid="secondaryButton"]');
            if (skipButton) {
                await skipButton.click();
                this.bot.log(this.bot.isMobile, 'LOGIN', '"Skip for now" button clicked successfully');
                await this.bot.utils.wait(5000); // Wait a bit after clicking
            }
            await this.bot.browser.utils.tryDismissAllMessages(page)
            const currentURL = new URL(page.url())
            if (currentURL.hostname === targetHostname && currentURL.pathname === targetPathname) {
                break
            }
        }

        // Wait for login to complete
        await page.waitForSelector('html[data-role-name="RewardsPortal"]', { timeout: 10000 })
        this.bot.log(this.bot.isMobile, 'LOGIN', 'Successfully logged into the rewards portal')
    }

    private async checkBingLogin(page: Page): Promise<void> {
        try {
            this.bot.log(this.bot.isMobile, 'LOGIN-BING', 'Verifying Bing login');
    
            await page.goto('https://www.bing.com/fd/auth/signin?action=interactive&provider=windows_live_id&return_url=https%3A%2F%2Fwww.bing.com%2F');
            await page.waitForLoadState('load'); // Aguarda a página carregar totalmente
    
            const maxIterations = 5;
            await this.bot.utils.wait(1000);
    
            for (let iteration = 1; iteration <= maxIterations; iteration++) {
                const currentUrl = new URL(page.url());
    
                if (currentUrl.hostname === 'www.bing.com' && currentUrl.pathname === '/') {
                    const skipButton = await page.$('button[data-testid="secondaryButton"]');
                    if (skipButton) {
                        await skipButton.click();
                        this.bot.log(this.bot.isMobile, 'LOGIN', '"Skip for now" button clicked successfully');
                        await this.bot.utils.wait(5000); // Wait a bit after clicking
                    }
                    await this.bot.browser.utils.tryDismissAllMessages(page);
                    await this.bot.utils.wait(1000);
    
                    try {
                        // Aguarda o botão aparecer, com timeout de 3 segundos
                        await page.waitForSelector('#bnp_btn_accept a', { timeout: 3000 });
                        const acceptButton = await page.$('#bnp_btn_accept a');
                        if (acceptButton) {
                            await acceptButton.click();
                            this.bot.log(this.bot.isMobile, 'LOGIN', '"Accept" button from Bing Cookie Banner clicked successfully');
                            await this.bot.utils.wait(3000);
                        }
                    } catch {
                        this.bot.log(this.bot.isMobile, 'LOGIN', 'No cookie banner to accept (or not visible).');
                    }
    
                    const loggedIn = await this.checkBingLoginStatus(page);
                    if (loggedIn || this.bot.isMobile) {
                        this.bot.log(this.bot.isMobile, 'LOGIN-BING', 'Bing login verification passed!');
                        break;
                    }
                }
    
                await this.bot.utils.wait(1000);
            }
        } catch (error) {
            this.bot.log(this.bot.isMobile, 'LOGIN-BING', 'An error occurred: ' + error, 'error');
        }
    }
    

    private async checkBingLoginStatus(page: Page): Promise<boolean> {
        try {
            await page.waitForSelector('#id_n', { timeout: 5000 })
            return true
        } catch (error) {
            return false
        }
    }

    async getMobileAccessToken(page: Page, email: string) {
        const authorizeUrl = new URL(this.authBaseUrl)

        authorizeUrl.searchParams.append('response_type', 'code')
        authorizeUrl.searchParams.append('client_id', this.clientId)
        authorizeUrl.searchParams.append('redirect_uri', this.redirectUrl)
        authorizeUrl.searchParams.append('scope', this.scope)
        authorizeUrl.searchParams.append('state', crypto.randomBytes(16).toString('hex'))
        authorizeUrl.searchParams.append('access_type', 'offline_access')
        authorizeUrl.searchParams.append('login_hint', email)

        await page.goto(authorizeUrl.href)

        let currentUrl = new URL(page.url())
        let code: string
        this.bot.log(this.bot.isMobile, 'LOGIN-APP', 'Waiting for authorization...')
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (currentUrl.hostname === 'login.live.com' && currentUrl.pathname === '/oauth20_desktop.srf') {
                code = currentUrl.searchParams.get('code')!
                break
            }

            currentUrl = new URL(page.url())
            await this.bot.utils.wait(5000)
        }

        const body = new URLSearchParams()
        body.append('grant_type', 'authorization_code')
        body.append('client_id', this.clientId)
        body.append('code', code)
        body.append('redirect_uri', this.redirectUrl)

        const tokenRequest: AxiosRequestConfig = {
            url: this.tokenUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: body.toString()
        }

        const tokenResponse = await this.bot.axios.request(tokenRequest)
        const tokenData: OAuth = await tokenResponse.data

        this.bot.log(this.bot.isMobile, 'LOGIN-APP', 'Successfully authorized')
        return tokenData.access_token
    }
    
    private async checkAccountLocked(page: Page) {
        await this.bot.utils.wait(2000)
        const isLocked = await page.waitForSelector('#serviceAbuseLandingTitle', { state: 'visible', timeout: 1000 }).then(() => true).catch(() => false)
        if (isLocked) {
            throw this.bot.log(this.bot.isMobile, 'CHECK-LOCKED', 'This account has been locked! Remove the account from "accounts.json" and restart!', 'error')
        }
    }
}
