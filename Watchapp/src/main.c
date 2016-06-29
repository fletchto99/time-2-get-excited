#include <pebble.h>
#include "kiezelpay.h"

#define APP_KEY_BACKERS 0
#define APP_KEY_MONEY 1
#define APP_KEY_TIME_REMAINING 2
#define END_TIME 1467262799
	
Layer *time_layer;

char backers[64], money[64], time_remaining[64], current_time[32];
bool ready = false;

static void send_request() {
	DictionaryIterator *iter;
	app_message_outbox_begin(&iter);
    dict_write_end(iter);
	app_message_outbox_send();
}

void process_tuple(Tuple *t){
	int key = t->key;
	
	if(key == APP_KEY_BACKERS){
		snprintf(backers, sizeof(backers), "%s backers", t->value->cstring);
		persist_write_string(APP_KEY_BACKERS, backers);
	} else if(key == APP_KEY_MONEY){
		snprintf(money, sizeof(money), "$%s raised", t->value->cstring);
		persist_write_string(APP_KEY_MONEY, money);
	}
	layer_mark_dirty(time_layer);
}

static void in_received_handler(DictionaryIterator *iter, void *context){
	Tuple *t = dict_read_first(iter);
	if(t){
		process_tuple(t);
	}
	while(t != NULL){
		t = dict_read_next(iter);
		if(t){
			process_tuple(t);
		}
	}
	
	layer_mark_dirty(time_layer);
}

static void draw_layer(Layer *layer, GContext *ctx) {
	GRect bounds = layer_get_bounds(layer);

	graphics_context_set_fill_color(ctx, GColorBlack);
	graphics_fill_rect(ctx, GRect(0, 0, bounds.size.w, PBL_IF_ROUND_ELSE(64, 58)), 0, GCornerNone);
	graphics_fill_rect(ctx, GRect(0, 112, bounds.size.w, bounds.size.h - 112), 0, GCornerNone);
	
	graphics_context_set_text_color(ctx, COLOR_FALLBACK(GColorGreen, GColorMediumAquamarine));
	graphics_draw_text(ctx, "TIME 2", fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD), GRect(2, PBL_IF_ROUND_ELSE(18, -8), bounds.size.w - 2, 44), GTextOverflowModeFill, GTextAlignmentCenter, NULL);
	
	#if !defined(PBL_ROUND)
		graphics_draw_text(ctx, "get excited", fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD), GRect(2, PBL_IF_ROUND_ELSE(36, 26), bounds.size.w - 2, 48), GTextOverflowModeFill, GTextAlignmentCenter, NULL);
	#endif

    int time_left = END_TIME - time(NULL);
    if (time_left > 0 && time_left < 60) {
        char countdown[] = "00";
        snprintf(countdown, sizeof(countdown), "%d", time_left);
        graphics_draw_text(ctx, countdown, fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD), GRect(4, 112, bounds.size.w - 4, 24), GTextOverflowModeFill, GTextAlignmentCenter, NULL);
    } else if (time_left > -60 && time_left <= 0) {
        graphics_draw_text(ctx, "ITS HERE!!", fonts_get_system_font(FONT_KEY_GOTHIC_28_BOLD), GRect(4, PBL_IF_ROUND_ELSE(112, 120), bounds.size.w - 4, 24), GTextOverflowModeFill, GTextAlignmentCenter, NULL);
    } else {
        graphics_draw_text(ctx, money, fonts_get_system_font(FONT_KEY_GOTHIC_18), GRect(PBL_IF_ROUND_ELSE(30, 4), 112, bounds.size.w - 4, 24), GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
        graphics_draw_text(ctx, backers, fonts_get_system_font(FONT_KEY_GOTHIC_18), GRect(PBL_IF_ROUND_ELSE(50, 4), 128, 140, 24), GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL);
        graphics_draw_text(ctx, time_remaining, fonts_get_system_font(FONT_KEY_GOTHIC_18), GRect(PBL_IF_ROUND_ELSE(55, 4), 144, bounds.size.w - 4, 24), GTextOverflowModeTrailingEllipsis, GTextAlignmentLeft, NULL); 
    }
	
	graphics_context_set_text_color(ctx, GColorBlack);
	graphics_draw_text(ctx, current_time, fonts_get_system_font(FONT_KEY_ROBOTO_BOLD_SUBSET_49), GRect(0, PBL_IF_ROUND_ELSE(58, 54), bounds.size.w, 56), GTextOverflowModeTrailingEllipsis, GTextAlignmentCenter, NULL);
}

void handle_tick(struct tm *tick_time, TimeUnits units_changed){

    if (units_changed & MINUTE_UNIT || ready == false) {
        if(clock_is_24h_style()) {
            strftime(current_time, sizeof(current_time), "%H:%M", tick_time);
        }  else {
            strftime(current_time, sizeof(current_time), "%I:%M", tick_time);
        }

        if (tick_time->tm_min%10 == 0) {
            send_request();
        }
    }

    int time_left = END_TIME - time(NULL);
    bool on_second = false;

    if (time_left <= 3600 && time_left >= 0) {
        on_second = true;
    }

    if (time_left <= 0) {
        if (time_left == 0) {
            vibes_long_pulse();
        }
        snprintf(time_remaining, sizeof(time_remaining), "%s", "Its here!!");
    } else if (ready == false || (time_left > 0 && ((on_second && units_changed & SECOND_UNIT) || units_changed & MINUTE_UNIT))) {
       // calculate (and subtract) whole days
        int days = time_left / 86400;
        time_left -= days * 86400;

        int hours = (time_left / 3600) % 24;
        time_left -= hours * 3600;

        int minutes = (time_left / 60) % 60;
        time_left -= minutes * 60;

        int seconds = time_left % 60; 

        if (days > 0 || hours > 0) {
            snprintf(time_remaining, sizeof(time_remaining), "%dD %dH %dM %s", days, hours, (minutes+1), PBL_IF_ROUND_ELSE("", "remaining"));
        } else {
            snprintf(time_remaining, sizeof(time_remaining), "%dH %dM %dS %s", hours, minutes, seconds, PBL_IF_ROUND_ELSE("", " remaining"));
        } 

        if (hours == 0 && minutes == 0  && days == 0) {
            if (seconds <= 10) {
                vibes_short_pulse();
            } if (seconds <= 20) {
                vibes_double_pulse();
            }
        }
    }
    
    if ((on_second && units_changed & SECOND_UNIT) || units_changed & MINUTE_UNIT || ready == false) {
        layer_mark_dirty(time_layer);
        ready = true;
    } 
    
}

void init(void){
    kiezelpay_settings.messaging_inbox_size = 128;
    kiezelpay_settings.messaging_outbox_size = 128;

    // Listen for AppMessages
    kiezelpay_settings.on_inbox_received = in_received_handler;

    // Initiate KiezelPay
    kiezelpay_init();
	
	if (persist_exists(APP_KEY_BACKERS)) {
       persist_read_string(APP_KEY_BACKERS, backers, sizeof(backers)); 
    } 
	if (persist_exists(APP_KEY_MONEY)) {
        persist_read_string(APP_KEY_MONEY, money, sizeof(money));
    }
	
    //UI
	Window *main_window = window_create();
	window_set_background_color(main_window, GColorWhite);
    Layer *window_layer = window_get_root_layer(main_window);
    GRect bounds = layer_get_bounds(window_layer);
	
	time_layer = layer_create(bounds);
	layer_set_update_proc(time_layer, draw_layer);
	layer_add_child(window_layer, time_layer);
	
	window_stack_push(main_window, true);
	
    //Services
    tick_timer_service_subscribe(SECOND_UNIT, handle_tick);
}

int main(void){
	init();
	app_event_loop();
}