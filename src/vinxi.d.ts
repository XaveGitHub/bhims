declare module "vinxi/http" {
	export function getEvent(): any;
	export function setCookie(
		event: any,
		name: string,
		value: string,
		options?: any,
	): void;
	export function getCookie(event: any, name: string): string | undefined;
	export function deleteCookie(event: any, name: string, options?: any): void;
}
